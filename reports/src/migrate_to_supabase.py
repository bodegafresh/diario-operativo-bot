"""
migrate_to_supabase.py
Migra los datos de Google Sheets (o Excel) a Supabase (PostgreSQL).

Uso:
    cd reports
    python -m src.migrate_to_supabase                              # todas las tablas, source del .env
    python -m src.migrate_to_supabase --source sheets --dry-run    # validar sin escribir
    python -m src.migrate_to_supabase --tables daily checkins      # subset de tablas
    python -m src.migrate_to_supabase --source excel --excel-path ../diario.xlsx

Variables de entorno requeridas (en reports/.env):
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY=eyJ...          # service_role key (bypasea RLS)

    # Si SOURCE=sheets:
    GOOGLE_SHEETS_SPREADSHEET_ID=...
    GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

    # Si SOURCE=excel:
    EXCEL_PATH=../diario operativo.xlsx
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime
from typing import Any, Optional

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

# ── Constantes ─────────────────────────────────────────────────────────────────

BATCH_SIZE = 100
ALL_TABLES = ["daily", "checkins", "pomodoro", "coach_state", "coach", "english_voice"]

# Valores válidos para cada enum
MOOD_VALUES = {
    "calma", "enfocado", "energético", "confianza", "motivado",
    "neutral", "estable", "cansado", "disperso", "ansioso",
    "inquieto", "irritable", "frustrado", "abrumado", "vulnerable",
    "impulsivo", "desanimado", "gratitud",
}
FOCUS_TYPE_VALUES     = {"trading", "lectura", "estudio", "none"}
ALCOHOL_CTX_VALUES    = {"social", "solo", "unknown"}
STALK_INT_VALUES      = {"low", "mid", "high", "none"}
POMO_EVENT_VALUES     = {"start", "end"}
POMO_PHASE_VALUES     = {"work", "short_break", "long_break"}
COACH_LEVEL_VALUES    = {"suave", "estandar", "desafiante"}
COACH_TIER_VALUES     = {"valid", "fragile", "reset_alcohol", "reset_score"}
EV_STATUS_VALUES      = {"RECEIVED", "SAVED_TO_DRIVE", "TRANSCRIBED", "ANALYZED", "REPLIED", "FAILED"}


# ── Argument Parsing ────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Migra Google Sheets → Supabase")
    p.add_argument("--source", choices=["excel", "sheets"],
                   default=os.getenv("SOURCE", "sheets"))
    p.add_argument("--excel-path",
                   default=os.getenv("EXCEL_PATH", "diario operativo.xlsx"))
    p.add_argument("--spreadsheet-id",
                   default=os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID"))
    p.add_argument("--creds",
                   default=os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
    p.add_argument("--tables", nargs="+", choices=ALL_TABLES, default=ALL_TABLES,
                   help="Subset de tablas a migrar (default: todas)")
    p.add_argument("--dry-run", action="store_true",
                   help="Parsea y coerciona datos pero no escribe en Supabase")
    p.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    return p.parse_args()


# ── Supabase client ─────────────────────────────────────────────────────────────

def _get_supabase_client():
    from supabase import create_client  # lazy import: solo si no es dry-run

    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if not url:
        raise ValueError("Falta SUPABASE_URL en el entorno.")
    if not key:
        raise ValueError("Falta SUPABASE_SERVICE_KEY en el entorno.")
    return create_client(url, key)


# ── Helpers de coerción de tipos ────────────────────────────────────────────────

def _is_na(v: Any) -> bool:
    if v is None:
        return True
    # pd.NA, np.nan, pd.NaT — todos pasan por pd.isna()
    try:
        if pd.isna(v):
            return True
    except (TypeError, ValueError):
        pass
    if isinstance(v, str) and v.strip().lower() in ("", "none", "nan", "nat", "<na>"):
        return True
    return False


def _to_bool(v: Any) -> Optional[bool]:
    if _is_na(v):
        return None
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in ("1", "true", "yes", "si", "sí"):
        return True
    if s in ("0", "false", "no"):
        return False
    return None


def _to_bool_f(v: Any) -> bool:
    """Igual que _to_bool pero devuelve False en lugar de None."""
    r = _to_bool(v)
    return r if r is not None else False


def _to_int(v: Any) -> Optional[int]:
    if _is_na(v):
        return None
    try:
        return int(float(str(v)))
    except (ValueError, TypeError):
        return None


def _to_int_z(v: Any) -> int:
    """Igual que _to_int pero devuelve 0 en lugar de None."""
    r = _to_int(v)
    return r if r is not None else 0


def _to_float(v: Any) -> Optional[float]:
    if _is_na(v):
        return None
    try:
        return float(str(v))
    except (ValueError, TypeError):
        return None


def _to_str(v: Any) -> Optional[str]:
    if _is_na(v):
        return None
    s = str(v).strip()
    return s if s else None


def _to_date_str(v: Any) -> Optional[str]:
    """Devuelve string YYYY-MM-DD o None."""
    if _is_na(v):
        return None
    if isinstance(v, (date, datetime)):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    if not s:
        return None
    try:
        return pd.to_datetime(s).strftime("%Y-%m-%d")
    except Exception:
        return None


def _to_timestamptz(v: Any) -> Optional[str]:
    """Devuelve string ISO 8601 con timezone o None."""
    if _is_na(v):
        return None
    if isinstance(v, datetime):
        return v.isoformat() if v.tzinfo else v.isoformat() + "+00:00"
    if isinstance(v, date):
        return datetime(v.year, v.month, v.day).isoformat() + "+00:00"
    s = str(v).strip()
    if not s:
        return None
    try:
        return pd.to_datetime(s).isoformat()
    except Exception:
        return None


def _to_jsonb(v: Any, default: Any = None) -> Any:
    """Parsea JSON string → dict/list, o devuelve el valor si ya es dict/list."""
    if _is_na(v):
        return default
    if isinstance(v, (dict, list)):
        return v
    s = str(v).strip()
    if not s:
        return default
    try:
        return json.loads(s)
    except (json.JSONDecodeError, ValueError):
        return default


def _to_enum(v: Any, valid: set, default: Optional[str] = None) -> Optional[str]:
    if _is_na(v):
        return default
    s = str(v).strip().lower()
    return s if s in valid else default


def _to_enum_upper(v: Any, valid: set, default: Optional[str] = None) -> Optional[str]:
    """Como _to_enum pero preserva mayúsculas (para ev_status_enum)."""
    if _is_na(v):
        return default
    s = str(v).strip().upper()
    return s if s in valid else default


# ── Coercers por tabla ──────────────────────────────────────────────────────────

def coerce_daily_row(row: dict) -> Optional[dict]:
    date_str = _to_date_str(row.get("date"))
    if not date_str:
        return None  # fila sin fecha → omitir
    return {
        "recorded_at":         _to_timestamptz(row.get("timestamp")),
        "date":                date_str,
        "from_name":           _to_str(row.get("from_name")),
        "from_user":           _to_str(row.get("from_user")),
        "chat_id":             _to_str(row.get("chat_id")),
        "message_id":          _to_str(row.get("message_id")),
        "reply_to_message_id": _to_str(row.get("reply_to_message_id")),
        "sleep_hours":         _to_float(row.get("sleep_hours")),
        "energy":              _to_int(row.get("energy")),
        "mood":                _to_enum(row.get("mood"), MOOD_VALUES),
        "focus_type":          _to_enum(row.get("focus_type"), FOCUS_TYPE_VALUES, default="none"),
        "focus_minutes":       _to_int_z(row.get("focus_minutes")),
        "training_json":       _to_jsonb(row.get("training_json"), default=[]),
        "alcohol_consumed":    _to_bool_f(row.get("alcohol_consumed")),
        "alcohol_context":     _to_enum(row.get("alcohol_context"), ALCOHOL_CTX_VALUES, default="unknown"),
        "alcohol_units":       _to_float(row.get("alcohol_units")) or 0.0,
        "stalk_occurred":      _to_bool_f(row.get("stalk_occurred")),
        "stalk_intensity":     _to_enum(row.get("stalk_intensity"), STALK_INT_VALUES, default="none"),
        "trading_trades":      _to_int_z(row.get("trading_trades")),
        "game_commits":        _to_int_z(row.get("game_commits")),
        "feature_done":        _to_bool_f(row.get("feature_done")),
        "notes":               _to_str(row.get("notes")),
        "raw":                 _to_str(row.get("raw")),
    }


def coerce_checkin_row(row: dict) -> Optional[dict]:
    date_str = _to_date_str(row.get("date"))
    msg_id   = _to_str(row.get("message_id"))
    if not date_str or not msg_id:
        return None  # message_id es la clave de upsert → obligatorio
    return {
        "recorded_at":   _to_timestamptz(row.get("timestamp")),
        "date":          date_str,
        "from_name":     _to_str(row.get("from_name")),
        "from_user":     _to_str(row.get("from_user")),
        "chat_id":       _to_str(row.get("chat_id")),
        "message_id":    msg_id,
        "question":      _to_str(row.get("question")) or "",
        "intensity_0_10": _to_int(row.get("intensity_0_10")),
        "answer_raw":    _to_str(row.get("answer_raw")),
    }


def coerce_pomodoro_row(row: dict) -> Optional[dict]:
    date_str    = _to_date_str(row.get("date"))
    recorded_at = _to_timestamptz(row.get("timestamp"))
    if not date_str or not recorded_at:
        return None  # recorded_at es la clave de deduplicación
    return {
        "recorded_at": recorded_at,
        "date":        date_str,
        "event":       _to_enum(row.get("event"), POMO_EVENT_VALUES),
        "phase":       _to_enum(row.get("phase"), POMO_PHASE_VALUES),
        "cycle":       _to_int(row.get("cycle")),
        "meta":        _to_jsonb(row.get("meta"), default={}),
    }


def coerce_coach_state_row(row: dict) -> Optional[dict]:
    date_str    = _to_date_str(row.get("date"))
    recorded_at = _to_timestamptz(row.get("timestamp"))
    if not date_str or not recorded_at:
        return None
    return {
        "recorded_at":                recorded_at,
        "date":                       date_str,
        "week_index":                 _to_int(row.get("week_index")),
        "day90":                      _to_int(row.get("day90")),
        "day21":                      _to_int(row.get("day21")),
        "cycle21":                    _to_int(row.get("cycle21")),
        "train_day14":                _to_int(row.get("train_day14")),
        "impulse_count":              _to_int_z(row.get("impulse_count")),
        "last_am":                    _to_date_str(row.get("last_am")),
        "last_pm":                    _to_date_str(row.get("last_pm")),
        "last_rem_1":                 _to_date_str(row.get("last_rem_1")),
        "last_rem_2":                 _to_date_str(row.get("last_rem_2")),
        "last_rem_3":                 _to_date_str(row.get("last_rem_3")),
        "last_rem_4":                 _to_date_str(row.get("last_rem_4")),
        "ritual_daily_date":          _to_date_str(row.get("ritual_daily_date")),
        "ritual_daily_affirmations":  _to_jsonb(row.get("ritual_daily_affirmations"), default=[]),
    }


def coerce_coach_row(row: dict) -> Optional[dict]:
    date_str = _to_date_str(row.get("date"))
    if not date_str:
        return None
    return {
        "recorded_at":        _to_timestamptz(row.get("timestamp")),
        "date":               date_str,
        "level":              _to_enum(row.get("level"), COACH_LEVEL_VALUES),
        "start_iso":          _to_date_str(row.get("start_iso")),
        "day90":              _to_int(row.get("day90")),
        "week_1_12":          _to_int(row.get("week_1_12")),
        "cycle21_1_4":        _to_int(row.get("cycle21_1_4")),
        "day21_1_21":         _to_int(row.get("day21_1_21")),
        "train_day14_1_14":   _to_int(row.get("train_day14_1_14")),
        "phase":              _to_str(row.get("phase")),
        "theme21":            _to_str(row.get("theme21")),
        "score_0_6":          _to_int(row.get("score_0_6")),
        "tier":               _to_enum(row.get("tier"), COACH_TIER_VALUES),
        "alcohol_bool":       _to_bool_f(row.get("alcohol_bool")),
        "impulses_count":     _to_int_z(row.get("impulses_count")),
        "workout_done":       _to_bool_f(row.get("workout_done")),
        "read_done":          _to_bool_f(row.get("read_done")),
        "voice_done":         _to_bool_f(row.get("voice_done")),
        "english_done":       _to_bool_f(row.get("english_done")),
        "story_done":         _to_bool_f(row.get("story_done")),
        "ritual_done":        _to_bool_f(row.get("ritual_done")),
        "note":               _to_str(row.get("note")),
        "raw_json":           _to_jsonb(row.get("raw_json"), default={}),
    }


def coerce_english_voice_row(row: dict) -> Optional[dict]:
    date_str = _to_date_str(row.get("date"))
    # Fallback a file_unique_id si message_id no está disponible (headers corruptos en Sheet)
    msg_id = _to_str(row.get("message_id")) or _to_str(row.get("file_unique_id"))
    if not date_str or not msg_id:
        return None
    return {
        "recorded_at":         _to_timestamptz(row.get("timestamp")),
        "updated_at":          _to_timestamptz(row.get("updated_at")),
        "date":                date_str,
        "chat_id":             _to_str(row.get("chat_id")),
        "message_id":          msg_id,
        "reply_to_message_id": _to_str(row.get("reply_to_message_id")),
        "file_id":             _to_str(row.get("file_id")),
        "file_unique_id":      _to_str(row.get("file_unique_id")),
        "mime_type":           _to_str(row.get("mime_type")),
        "file_size_bytes":     _to_int(row.get("file_size_bytes")),
        "duration_seconds":    _to_int(row.get("duration_seconds")),
        "drive_file_id":       _to_str(row.get("drive_file_id")),
        "drive_file_url":      _to_str(row.get("drive_file_url")),
        "status":              _to_enum_upper(row.get("status"), EV_STATUS_VALUES, default="RECEIVED"),
        "transcript_full":     _to_str(row.get("transcript_full")),
        "transcript_short":    _to_str(row.get("transcript_short")),
        "fixes_1":             _to_str(row.get("fixes_1")),
        "fixes_2":             _to_str(row.get("fixes_2")),
        "fixes_3":             _to_str(row.get("fixes_3")),
        "better_version":      _to_str(row.get("better_version")),
        "tomorrow_drill":      _to_str(row.get("tomorrow_drill")),
        "verb_focus":          _to_str(row.get("verb_focus")),
        "error_message":       _to_str(row.get("error_message")),
    }


# ── Configuración de upsert por tabla ───────────────────────────────────────────
# (coerce_fn, conflict_columns, update_on_conflict)
# conflict_columns=None → insert puro (coach_state ya tiene UNIQUE on recorded_at, usamos esa)
TABLE_CONFIG: dict[str, tuple] = {
    "daily":         (coerce_daily_row,        ["date", "from_user"], True),
    "checkins":      (coerce_checkin_row,       ["message_id"],        True),
    "pomodoro":      (coerce_pomodoro_row,      ["recorded_at"],       False),  # DO NOTHING
    "coach_state":   (coerce_coach_state_row,   ["recorded_at"],       False),  # DO NOTHING
    "coach":         (coerce_coach_row,         ["date"],              True),
    "english_voice": (coerce_english_voice_row, ["message_id"],        True),
}


# Columnas predefinidas por si el Sheet no tiene fila de encabezados
_SHEET_COLUMNS = {
    "CoachState": [
        "timestamp", "date", "week_index", "day90", "day21", "cycle21",
        "train_day14", "impulse_count", "last_am", "last_pm",
        "last_rem_1", "last_rem_2", "last_rem_3", "last_rem_4",
        "ritual_daily_date", "ritual_daily_affirmations",
    ],
    "EnglishVoice": [
        "timestamp", "date", "chat_id", "message_id", "reply_to_message_id",
        "file_id", "file_unique_id", "mime_type", "file_size_bytes",
        "duration_seconds", "drive_file_id", "drive_file_url", "status",
        "transcript_full", "transcript_short", "fixes_1", "fixes_2", "fixes_3",
        "better_version", "tomorrow_drill", "verb_focus", "error_message", "updated_at",
    ],
}


# ── Carga de tablas extra (CoachState, EnglishVoice) ───────────────────────────

def _load_extra_sheets(spreadsheet_id: str, creds_path: str) -> dict[str, pd.DataFrame]:
    """
    Carga CoachState y EnglishVoice, que no están en el DataBundle principal.
    Replica el patrón _ws_to_df() + _normalize_columns() de loaders.py.
    """
    from pathlib import Path
    import gspread
    from google.oauth2.service_account import Credentials

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
    ]
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(spreadsheet_id)

    extra: dict[str, pd.DataFrame] = {}
    for tab_name, key in [("CoachState", "coach_state"), ("EnglishVoice", "english_voice")]:
        try:
            ws = sh.worksheet(tab_name)
            # Usamos get_all_values() para evitar errores con headers vacíos/duplicados
            all_values = ws.get_all_values()
            if not all_values:
                extra[key] = pd.DataFrame()
                print(f"  [WARN] '{tab_name}' vacío")
                continue

            # Buscar la primera fila que tenga "timestamp" como valor de celda
            # (es una cadena que solo aparece en la fila de encabezados)
            header_row_idx = None
            for i, row in enumerate(all_values):
                cells = [str(c).strip().lower() for c in row]
                if "timestamp" in cells:
                    header_row_idx = i
                    break

            if header_row_idx is None:
                # Sin fila de encabezados → usar columnas predefinidas
                predefined = _SHEET_COLUMNS.get(tab_name)
                if not predefined:
                    print(f"  [WARN] '{tab_name}': sin encabezados y sin columnas predefinidas, saltando")
                    extra[key] = pd.DataFrame()
                    continue
                print(f"  [WARN] '{tab_name}': sin fila de encabezados, usando columnas predefinidas")
                headers   = predefined
                data_rows = [r for r in all_values if any(str(c).strip() for c in r)]
            else:
                if header_row_idx > 0:
                    print(f"  [WARN] '{tab_name}': {header_row_idx} fila(s) antes del encabezado, ignoradas")
                raw_headers = all_values[header_row_idx]
                data_rows   = all_values[header_row_idx + 1:]
                # Normalizar/deduplicar headers
                seen: dict[str, int] = {}
                headers = []
                for h in raw_headers:
                    h_norm = str(h).replace("\ufeff", "").strip().lower().replace(" ", "_")
                    if h_norm in seen:
                        seen[h_norm] += 1
                        headers.append(f"{h_norm}_{seen[h_norm]}" if h_norm else f"_col_{seen[h_norm]}")
                    else:
                        seen[h_norm] = 0
                        headers.append(h_norm)

            # Ajustar longitud de filas al número de columnas; descartar filas vacías
            n_cols = len(headers)
            padded = [r + [""] * max(0, n_cols - len(r)) for r in data_rows]
            padded = [r for r in padded if any(str(c).strip() for c in r)]

            df = pd.DataFrame(padded, columns=headers)
            df = df.replace({"": pd.NA, " ": pd.NA})
            extra[key] = df
            print(f"  Cargado '{tab_name}': {len(df)} filas")
        except Exception as e:
            print(f"  [WARN] No se pudo cargar '{tab_name}': {e}")
            extra[key] = pd.DataFrame()
    return extra


def _load_extra_excel(excel_path: str) -> dict[str, pd.DataFrame]:
    """Carga CoachState y EnglishVoice desde un archivo Excel."""
    from pathlib import Path
    path = Path(excel_path)
    extra: dict[str, pd.DataFrame] = {}
    for tab_name, key in [("CoachState", "coach_state"), ("EnglishVoice", "english_voice")]:
        try:
            df = pd.read_excel(path, sheet_name=tab_name)
            df.columns = [
                str(c).replace("\ufeff", "").strip().lower().replace(" ", "_")
                for c in df.columns
            ]
            df = df.replace({"": pd.NA, " ": pd.NA})
            extra[key] = df
            print(f"  Cargado '{tab_name}' (Excel): {len(df)} filas")
        except Exception as e:
            print(f"  [WARN] No se pudo cargar '{tab_name}' desde Excel: {e}")
            extra[key] = pd.DataFrame()
    return extra


# ── Upsert por batches ──────────────────────────────────────────────────────────

def _upsert_batch(
    client: Any,
    table: str,
    rows: list[dict],
    conflict_cols: list[str],
    update_on_conflict: bool,
    dry_run: bool,
) -> tuple[int, int]:
    """Retorna (insertados, errores)."""
    if dry_run:
        return len(rows), 0
    try:
        if update_on_conflict:
            client.table(table).upsert(
                rows,
                on_conflict=",".join(conflict_cols),
            ).execute()
        else:
            client.table(table).upsert(
                rows,
                on_conflict=",".join(conflict_cols),
                ignore_duplicates=True,
            ).execute()
        return len(rows), 0
    except Exception as e:
        print(f"    [ERROR] batch en '{table}': {e}")
        return 0, len(rows)


# ── Migración de una tabla ──────────────────────────────────────────────────────

def migrate_table(
    client: Any,
    table: str,
    df: pd.DataFrame,
    batch_size: int,
    dry_run: bool,
) -> None:
    coerce_fn, conflict_cols, update_on_conflict = TABLE_CONFIG[table]

    if df is None or df.empty:
        print(f"  [SKIP] '{table}' — DataFrame vacío")
        return

    coerced: list[dict] = []
    skipped = 0
    for _, row in df.iterrows():
        record = coerce_fn(row.to_dict())
        if record is None:
            skipped += 1
        else:
            coerced.append(record)

    print(f"  '{table}': {len(df)} filas → {len(coerced)} válidas, {skipped} omitidas")

    if not coerced:
        if skipped > 0:
            # Diagnóstico: muestra la primera fila para entender por qué se omitió
            sample = df.iloc[0].to_dict()
            date_val  = sample.get("date")
            msg_val   = sample.get("message_id")
            fuid_val  = sample.get("file_unique_id")
            ts_val    = sample.get("timestamp")
            date_str  = _to_date_str(date_val)
            msg_str   = _to_str(msg_val) or _to_str(fuid_val)
            print(f"  [DEBUG] Columnas ({len(df.columns)}): {list(df.columns[:8])}")
            print(f"  [DEBUG] Primera fila →")
            print(f"    date       = {date_val!r}  →  date_str={date_str!r}")
            print(f"    timestamp  = {ts_val!r}")
            print(f"    message_id = {msg_val!r}  →  msg_str={msg_str!r}")
            print(f"    file_unique_id = {fuid_val!r}")
        return

    # Deduplicar por conflict keys para evitar "ON CONFLICT DO UPDATE can't affect a row twice"
    if conflict_cols:
        before = len(coerced)
        seen: dict = {}
        for row in coerced:
            k = tuple(row.get(c) for c in conflict_cols)
            seen[k] = row  # el último gana (misma lógica que el Sheet: fila más reciente)
        coerced = list(seen.values())
        if len(coerced) < before:
            print(f"  '{table}': dedup por {conflict_cols} → {before - len(coerced)} duplicados eliminados")

    batches = [coerced[i : i + batch_size] for i in range(0, len(coerced), batch_size)]
    total_ok = 0
    total_err = 0

    for i, batch in enumerate(batches, 1):
        ok, err = _upsert_batch(client, table, batch, conflict_cols, update_on_conflict, dry_run)
        total_ok += ok
        total_err += err
        suffix = "(dry-run)" if dry_run else "upserted"
        print(f"    batch {i}/{len(batches)}: {ok} {suffix}, {err} errores")

    estado = "DRY RUN" if dry_run else "OK"
    print(f"  [{estado}] '{table}': {total_ok} procesadas, {total_err} errores")


# ── Main ────────────────────────────────────────────────────────────────────────

def main() -> int:
    args = parse_args()

    print("=== Migración a Supabase ===")
    print(f"  Fuente:     {args.source}")
    print(f"  Tablas:     {args.tables}")
    print(f"  Dry-run:    {args.dry_run}")
    print(f"  Batch size: {args.batch_size}")
    print()

    # Cargar tablas principales via loaders.py existente
    from .diario.loaders import load_data
    print("Cargando datos principales (Daily, Checkins, Pomodoro, Coach)...")
    data = load_data(
        source=args.source,
        excel_path=args.excel_path,
        spreadsheet_id=args.spreadsheet_id,
        creds_path=args.creds,
    )
    print()

    # Cargar tablas extra (CoachState, EnglishVoice)
    extra: dict[str, pd.DataFrame] = {}
    needs_extra = any(t in args.tables for t in ("coach_state", "english_voice"))
    if needs_extra:
        print("Cargando tablas extra (CoachState, EnglishVoice)...")
        if args.source == "sheets":
            extra = _load_extra_sheets(args.spreadsheet_id, args.creds)
        else:
            extra = _load_extra_excel(args.excel_path)
        print()

    # Mapa tabla → DataFrame
    table_data: dict[str, pd.DataFrame] = {
        "daily":         data.daily,
        "checkins":      data.checkins,
        "pomodoro":      data.pomodoro,
        "coach":         data.coach,
        "coach_state":   extra.get("coach_state", pd.DataFrame()),
        "english_voice": extra.get("english_voice", pd.DataFrame()),
    }

    # Cliente Supabase
    client = None if args.dry_run else _get_supabase_client()

    # Ejecutar migraciones
    print("Iniciando migración...")
    print()
    for table in args.tables:
        print(f"--- {table} ---")
        migrate_table(
            client=client,
            table=table,
            df=table_data.get(table, pd.DataFrame()),
            batch_size=args.batch_size,
            dry_run=args.dry_run,
        )
        print()

    print("=== Migración completada ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
