from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any, Tuple
import math

import pandas as pd

from .loaders import DataBundle

def _coerce_date(df: pd.DataFrame, col: str = "date") -> pd.Series:
    s = pd.to_datetime(df[col], errors="coerce").dt.date
    return s

def _week_id(d: pd.Series) -> pd.Series:
    # ISO week label like 2026-W02
    dtidx = pd.to_datetime(d.astype(str), errors="coerce")
    iso = dtidx.dt.isocalendar()
    return iso["year"].astype(str) + "-W" + iso["week"].astype(str).str.zfill(2)

def _month_id(d: pd.Series) -> pd.Series:
    dtidx = pd.to_datetime(d.astype(str), errors="coerce")
    return dtidx.dt.strftime("%Y-%m")

def _safe_int(x, default=0) -> int:
    try:
        if pd.isna(x):
            return default
        return int(x)
    except Exception:
        return default

@dataclass
class KPIBundle:
    daily_table: pd.DataFrame
    weekly_table: pd.DataFrame
    monthly_table: pd.DataFrame
    heatmap: pd.DataFrame   # index=date, columns=metric(s)
    meta: Dict[str, Any]

def build_kpis(data: DataBundle, tz: str = "America/Santiago") -> KPIBundle:
    # --- DAILY normalization ---
    daily = data.daily.copy()

    if "date" not in daily.columns:
        raise ValueError("Daily sheet must include a 'date' column")

    daily["date"] = _coerce_date(daily, "date")
    daily = daily.dropna(subset=["date"])

    # Numeric columns
    num_cols = ["sleep_hours","energy","focus_minutes","alcohol_units","stalk_intensity","trading_trades","game_commits"]
    for c in num_cols:
        if c in daily.columns:
            daily[c] = pd.to_numeric(daily[c], errors="coerce")

    # Boolean-ish columns
    for c in ["alcohol_consumed","stalk_occurred","feature_done"]:
        if c in daily.columns:
            daily[c] = daily[c].astype(str).str.strip().str.lower().map({"true":True,"false":False,"1":True,"0":False,"yes":True,"no":False}).fillna(False)

    # --- Pomodoro: compute minutes per day ---
    pomo = data.pomodoro.copy()
    pomo["date"] = _coerce_date(pomo, "date")
    pomo = pomo.dropna(subset=["date"])

    # A very robust approach would pair start/end timestamps by phase+cycle.
    # For MVP: count number of 'end work' events as completed work blocks, assume 25 min each.
    work_ends = pomo[(pomo["event"]=="end") & (pomo["phase"]=="work")].groupby("date").size().rename("work_blocks")
    pomo_daily = work_ends.to_frame()
    pomo_daily["pomodoro_minutes"] = pomo_daily["work_blocks"] * 25

    # --- Checkins: average intensity per day ---
    chk = data.checkins.copy()
    chk["date"] = _coerce_date(chk, "date")
    chk = chk.dropna(subset=["date"])
    if "intensity_0_10" in chk.columns:
        chk["intensity_0_10"] = pd.to_numeric(chk["intensity_0_10"], errors="coerce")
    chk_daily = chk.groupby("date").agg(
        checkins_count=("question","count"),
        checkins_intensity_avg=("intensity_0_10","mean"),
    )

    # --- Merge daily + pomo + checkins ---
    daily_key = daily.set_index("date")
    merged = daily_key.join(pomo_daily, how="left").join(chk_daily, how="left").reset_index()

    # Derived score (simple, tweak later)
    merged["score"] = (
        merged.get("energy", 0).fillna(0) * 1.5
        + merged.get("sleep_hours", 0).fillna(0) * 1.0
        + (merged.get("pomodoro_minutes", 0).fillna(0) / 50.0) * 2.0
        + merged.get("focus_minutes", 0).fillna(0) / 60.0
        - merged.get("alcohol_units", 0).fillna(0) * 0.8
        - merged.get("stalk_intensity", 0).fillna(0) * 0.6
    )
    merged["score"] = merged["score"].round(2)

    merged["week"] = _week_id(pd.Series(merged["date"]))
    merged["month"] = _month_id(pd.Series(merged["date"]))

    weekly = merged.groupby("week").agg(
        days=("date","count"),
        score_avg=("score","mean"),
        sleep_avg=("sleep_hours","mean"),
        energy_avg=("energy","mean"),
        pomodoro_min=("pomodoro_minutes","sum"),
        focus_min=("focus_minutes","sum"),
        alcohol_units=("alcohol_units","sum"),
        stalk_intensity_avg=("stalk_intensity","mean"),
        feature_done_days=("feature_done","sum"),
        trading_trades=("trading_trades","sum"),
        game_commits=("game_commits","sum"),
    ).reset_index()

    monthly = merged.groupby("month").agg(
        days=("date","count"),
        score_avg=("score","mean"),
        sleep_avg=("sleep_hours","mean"),
        energy_avg=("energy","mean"),
        pomodoro_min=("pomodoro_minutes","sum"),
        focus_min=("focus_minutes","sum"),
        alcohol_units=("alcohol_units","sum"),
        stalk_intensity_avg=("stalk_intensity","mean"),
        feature_done_days=("feature_done","sum"),
        trading_trades=("trading_trades","sum"),
        game_commits=("game_commits","sum"),
    ).reset_index()

    # Heatmap data: one row per date, a few key metrics
    heat_cols = ["score","energy","sleep_hours","pomodoro_minutes","focus_minutes","alcohol_units","stalk_intensity"]
    heat = merged[["date"] + [c for c in heat_cols if c in merged.columns]].copy()
    heat = heat.set_index("date").sort_index()

    meta = {"timezone": tz, "generated_from": "excel_or_sheets", "rows_daily": int(len(merged))}
    return KPIBundle(
        daily_table=merged.sort_values("date"),
        weekly_table=weekly.sort_values("week"),
        monthly_table=monthly.sort_values("month"),
        heatmap=heat,
        meta=meta,
    )
