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

def _read_excel(excel_path: str | Path) -> DataBundle:
    path = Path(excel_path)
    if not path.exists():
        raise FileNotFoundError(f"Excel not found: {path.resolve()}")
    daily = pd.read_excel(path, sheet_name="Daily")
    checkins = pd.read_excel(path, sheet_name="Checkins")
    pomodoro = pd.read_excel(path, sheet_name="Pomodoro")
    return DataBundle(daily=daily, checkins=checkins, pomodoro=pomodoro)

def _ws_to_df(ws) -> pd.DataFrame:
    """
    Reads a worksheet into a DataFrame.
    Assumes first row are headers (as in Sheets exported tables).
    """
    records = ws.get_all_records(default_blank="", head=1)
    return pd.DataFrame(records)

def _read_sheets(
    spreadsheet_id: Optional[str] = None,
    creds_path: Optional[str] = None,
    daily_tab: str = "Daily",
    checkins_tab: str = "Checkins",
    pomodoro_tab: str = "Pomodoro",
) -> DataBundle:
    """
    Reads Google Sheets tabs using a Service Account JSON.

    Required:
      - spreadsheet_id (env: GOOGLE_SHEETS_SPREADSHEET_ID)
      - creds_path (env: GOOGLE_APPLICATION_CREDENTIALS)

    Notes:
      - Share the spreadsheet with the service account email.
      - Tabs must be named exactly: Daily / Checkins / Pomodoro (or override names).
    """
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

    daily = _ws_to_df(daily_ws)
    checkins = _ws_to_df(checkins_ws)
    pomodoro = _ws_to_df(pomodoro_ws)

    return DataBundle(daily=daily, checkins=checkins, pomodoro=pomodoro)

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
