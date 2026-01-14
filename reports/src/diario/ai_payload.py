# src/diario/ai_payload.py
from __future__ import annotations

from typing import Any, Dict

import pandas as pd

from .json_safe import to_jsonable


def _coerce_date_series(df: pd.DataFrame, col: str = "date") -> pd.Series:
    return pd.to_datetime(df[col], errors="coerce").dt.date


def build_weekly_ai_payload(
    *,
    kpis: Any,
    data_bundle: Any,
    tz: str,
    weeks_back: int = 0,
    max_checkins: int = 120,
) -> Dict[str, Any]:
    """
    Payload para IA:
    - Daily: semana actual + semana anterior (para comparación)
    - Checkins: últimos N checkins (con pregunta+respuesta+intensidad)
    """
    # ---- Daily (kpis.daily_table) ----
    daily_df = kpis.daily_table.copy()
    if "date" in daily_df.columns:
        daily_df["date"] = _coerce_date_series(daily_df, "date")
        daily_df = daily_df.dropna(subset=["date"])
        daily_df = daily_df.sort_values("date")

    # Para weeks_back: filtra por week id si existe (ej: 2026-W02)
    daily_week = pd.DataFrame()
    daily_week_prev = pd.DataFrame()
    target_week = None
    prev_week = None

    if "week" in daily_df.columns and len(daily_df) > 0:
        weeks = sorted(daily_df["week"].dropna().unique().tolist())
        if weeks:
            idx = max(0, len(weeks) - 1 - int(weeks_back))
            target_week = weeks[idx]
            daily_week = daily_df[daily_df["week"] == target_week].copy()

            # Obtener semana anterior si existe
            if idx > 0:
                prev_week = weeks[idx - 1]
                daily_week_prev = daily_df[daily_df["week"] == prev_week].copy()
        else:
            daily_week = daily_df.tail(14).copy()
    else:
        daily_week = daily_df.tail(14).copy()

    # Solo columnas relevantes (si existen)
    daily_cols = [
        "date",
        "score",
        "energy",
        "sleep_hours",
        "pomodoro_minutes",
        "focus_minutes",
        "alcohol_units",
        "stalk_occurred",
        "stalk_intensity_label",
        "stalk_intensity",
        "feature_done",
        "coach_score",
        "coach_impulses",
    ]
    daily_cols = [c for c in daily_cols if c in daily_week.columns]
    daily_week = daily_week[daily_cols].copy()

    daily_records = []
    for _, row in daily_week.iterrows():
        rec = {k: to_jsonable(v) for k, v in row.items()}
        daily_records.append(rec)

    # Procesar semana anterior
    daily_records_prev = []
    if not daily_week_prev.empty:
        daily_week_prev = daily_week_prev[daily_cols].copy()
        for _, row in daily_week_prev.iterrows():
            rec = {k: to_jsonable(v) for k, v in row.items()}
            daily_records_prev.append(rec)

    # ---- Checkins (data_bundle.checkins) ----
    chk = data_bundle.checkins.copy() if getattr(data_bundle, "checkins", None) is not None else pd.DataFrame()

    if not chk.empty and "date" in chk.columns:
        chk["date"] = _coerce_date_series(chk, "date")
        chk = chk.dropna(subset=["date"])
        chk = chk.sort_values("date")

    # filtrar a misma semana que daily_week (si se puede)
    if not chk.empty and "date" in chk.columns and not daily_week.empty and "date" in daily_week.columns:
        min_d = pd.to_datetime(str(daily_week["date"].min()), errors="coerce")
        max_d = pd.to_datetime(str(daily_week["date"].max()), errors="coerce")
        if pd.notna(min_d) and pd.notna(max_d):
            chk = chk[(pd.to_datetime(chk["date"].astype(str), errors="coerce") >= min_d) &
                      (pd.to_datetime(chk["date"].astype(str), errors="coerce") <= max_d)].copy()

    # columnas reales según tu screenshot
    chk_cols = []
    for c in ["date", "question", "intensity_0_10", "answer_raw"]:
        if c in chk.columns:
            chk_cols.append(c)

    chk = chk[chk_cols].copy() if (not chk.empty and chk_cols) else pd.DataFrame(columns=["date", "question", "intensity_0_10", "answer_raw"])
    chk = chk.tail(int(max_checkins))

    checkins_records = []
    for _, row in chk.iterrows():
        rec = {k: to_jsonable(v) for k, v in row.items()}
        checkins_records.append(rec)

    payload = {
        "meta": {
            "timezone": tz,
            "weeks_back": int(weeks_back),
            "current_week": str(target_week) if target_week else None,
            "previous_week": str(prev_week) if prev_week else None,
        },
        "daily_current_week": daily_records,
        "daily_previous_week": daily_records_prev,
        "checkins": checkins_records,
    }
    return payload
