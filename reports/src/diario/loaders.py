from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import os
import pandas as pd


@dataclass
class DataBundle:
    daily: pd.DataFrame
    checkins: pd.DataFrame
    pomodoro: pd.DataFrame
    coach: pd.DataFrame


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [
        str(c)
        .replace("\ufeff", "")
        .strip()
        .lower()
        .replace(" ", "_")
        for c in df.columns
    ]
    return df


def _empty_to_na(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = df.replace({"": pd.NA, " ": pd.NA})
    return df


def _read_excel(excel_path: str | Path) -> DataBundle:
    path = Path(excel_path)
    if not path.exists():
        raise FileNotFoundError(f"Excel not found: {path.resolve()}")

    daily = pd.read_excel(path, sheet_name="Daily")
    checkins = pd.read_excel(path, sheet_name="Checkins")
    pomodoro = pd.read_excel(path, sheet_name="Pomodoro")
    try:
        coach = pd.read_excel(path, sheet_name="Coach")
    except Exception:
        coach = pd.DataFrame()

    daily = _empty_to_na(_normalize_columns(daily))
    checkins = _empty_to_na(_normalize_columns(checkins))
    pomodoro = _empty_to_na(_normalize_columns(pomodoro))
    coach = _empty_to_na(_normalize_columns(coach))

    return DataBundle(daily=daily, checkins=checkins, pomodoro=pomodoro, coach=coach)


def _ws_to_df(ws) -> pd.DataFrame:
    records = ws.get_all_records(default_blank="", head=1)
    df = pd.DataFrame(records)
    df = _empty_to_na(_normalize_columns(df))
    return df


def _read_sheets(
    spreadsheet_id: Optional[str] = None,
    creds_path: Optional[str] = None,
    daily_tab: str = "Daily",
    checkins_tab: str = "Checkins",
    pomodoro_tab: str = "Pomodoro",
    coach_tab: str = "Coach",
) -> DataBundle:
    spreadsheet_id = spreadsheet_id or os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID")
    creds_path = creds_path or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    if not spreadsheet_id:
        raise ValueError("Missing spreadsheet_id. Set GOOGLE_SHEETS_SPREADSHEET_ID or pass explicitly.")
    if not creds_path:
        raise ValueError("Missing creds_path. Set GOOGLE_APPLICATION_CREDENTIALS or pass explicitly.")

    creds_file = Path(creds_path)
    if not creds_file.exists():
        raise FileNotFoundError(f"Service account JSON not found: {creds_file.resolve()}")

    import gspread
    from google.oauth2.service_account import Credentials

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
    ]
    creds = Credentials.from_service_account_file(str(creds_file), scopes=scopes)
    gc = gspread.authorize(creds)

    sh = gc.open_by_key(spreadsheet_id)

    daily_ws = sh.worksheet(daily_tab)
    checkins_ws = sh.worksheet(checkins_tab)
    pomodoro_ws = sh.worksheet(pomodoro_tab)

    # Coach puede no existir aún
    coach_df = pd.DataFrame()
    try:
        coach_ws = sh.worksheet(coach_tab)
        coach_df = _ws_to_df(coach_ws)
    except Exception:
        coach_df = pd.DataFrame()

    daily = _ws_to_df(daily_ws)
    checkins = _ws_to_df(checkins_ws)
    pomodoro = _ws_to_df(pomodoro_ws)

    return DataBundle(daily=daily, checkins=checkins, pomodoro=pomodoro, coach=coach_df)


def load_data(
    source: str,
    excel_path: str = "diario operativo.xlsx",
    spreadsheet_id: Optional[str] = None,
    creds_path: Optional[str] = None,
) -> DataBundle:
    if source == "excel":
        return _read_excel(excel_path)
    if source == "sheets":
        return _read_sheets(spreadsheet_id=spreadsheet_id, creds_path=creds_path)
    raise ValueError(f"Unknown source: {source}")
