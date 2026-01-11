from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any

import pandas as pd

from .loaders import DataBundle


def _coerce_date(df: pd.DataFrame, col: str = "date") -> pd.Series:
    return pd.to_datetime(df[col], errors="coerce").dt.date


def _week_id(d: pd.Series) -> pd.Series:
    # ISO week label like 2026-W02
    dtidx = pd.to_datetime(d.astype(str), errors="coerce")
    iso = dtidx.dt.isocalendar()
    return iso["year"].astype(str) + "-W" + iso["week"].astype(str).str.zfill(2)


def _month_id(d: pd.Series) -> pd.Series:
    dtidx = pd.to_datetime(d.astype(str), errors="coerce")
    return dtidx.dt.strftime("%Y-%m")


@dataclass
class KPIBundle:
    daily_table: pd.DataFrame
    weekly_table: pd.DataFrame
    monthly_table: pd.DataFrame
    heatmap: pd.DataFrame  # index=date, columns=metric(s)
    meta: Dict[str, Any]


def build_kpis(data: DataBundle, tz: str = "America/Santiago") -> KPIBundle:
    # -------------------------
    # DAILY normalization
    # -------------------------
    daily = data.daily.copy()

    if "date" not in daily.columns:
        raise ValueError("Daily sheet must include a 'date' column")

    daily["date"] = _coerce_date(daily, "date")
    daily = daily.dropna(subset=["date"])

    # Numeric columns (ONLY numeric!)
    num_cols = [
        "sleep_hours",
        "energy",
        "focus_minutes",
        "alcohol_units",
        "trading_trades",
        "game_commits",
    ]
    for c in num_cols:
        if c in daily.columns:
            daily[c] = pd.to_numeric(daily[c], errors="coerce")

    # Boolean-ish columns
    bool_map = {
        "true": True,
        "false": False,
        "1": True,
        "0": False,
        "yes": True,
        "no": False,
    }
    for c in ["alcohol_consumed", "stalk_occurred", "feature_done"]:
        if c in daily.columns:
            daily[c] = (
                daily[c]
                .astype(str)
                .str.strip()
                .str.lower()
                .map(bool_map)
                .fillna(False)
            )

    # -------------------------
    # STALK: keep label + numeric intensity
    # Sheet has:
    # - stalk_occurred: TRUE/FALSE
    # - stalk_intensity: low/mid/high (text)
    # We want:
    # - stalk_intensity_label: "low/mid/high"
    # - stalk_intensity: 0..3 numeric (for score/heatmap)
    # -------------------------
    if "stalk_intensity" in daily.columns:
        daily["stalk_intensity_label"] = (
            daily["stalk_intensity"]
            .astype(str)
            .str.strip()
            .str.lower()
            .replace({"": None, "none": None, "nan": None})
        )

        intensity_map = {
            None: 0,
            "low": 1,
            "mid": 2,
            "medium": 2,
            "high": 3,
        }

        daily["stalk_intensity"] = daily["stalk_intensity_label"].map(intensity_map)

        # If stalk occurred but intensity missing -> assume low (=1)
        if "stalk_occurred" in daily.columns:
            daily.loc[
                (daily["stalk_occurred"] == True) & (daily["stalk_intensity"].isna()),
                "stalk_intensity",
            ] = 1

        daily["stalk_intensity"] = (
            pd.to_numeric(daily["stalk_intensity"], errors="coerce").fillna(0)
        )

    else:
        # If no column exists, create consistent fields
        daily["stalk_intensity_label"] = None
        daily["stalk_intensity"] = 0

    # -------------------------
    # Pomodoro: compute minutes per day
    # -------------------------
    pomo = data.pomodoro.copy()
    if "date" in pomo.columns:
        pomo["date"] = _coerce_date(pomo, "date")
        pomo = pomo.dropna(subset=["date"])
    else:
        pomo = pd.DataFrame(columns=["date", "event", "phase", "cycle"])

    # Count 'end work' events => completed work blocks, assume 25 min each.
    if not pomo.empty and {"event", "phase"}.issubset(pomo.columns):
        work_ends = (
            pomo[(pomo["event"] == "end") & (pomo["phase"] == "work")]
            .groupby("date")
            .size()
            .rename("work_blocks")
        )
        pomo_daily = work_ends.to_frame()
        pomo_daily["pomodoro_minutes"] = pomo_daily["work_blocks"] * 25
    else:
        pomo_daily = pd.DataFrame(columns=["work_blocks", "pomodoro_minutes"])

    # -------------------------
    # Checkins: average intensity per day
    # -------------------------
    chk = data.checkins.copy()
    if "date" in chk.columns:
        chk["date"] = _coerce_date(chk, "date")
        chk = chk.dropna(subset=["date"])
    else:
        chk = pd.DataFrame(columns=["date", "question", "intensity_0_10"])

    if "intensity_0_10" in chk.columns:
        chk["intensity_0_10"] = pd.to_numeric(chk["intensity_0_10"], errors="coerce")

    if not chk.empty and {"question"}.issubset(chk.columns):
        chk_daily = chk.groupby("date").agg(
            checkins_count=("question", "count"),
            checkins_intensity_avg=("intensity_0_10", "mean"),
        )
    else:
        chk_daily = pd.DataFrame(columns=["checkins_count", "checkins_intensity_avg"])

    # -------------------------
    # Merge daily + pomo + checkins
    # -------------------------
    merged = (
        daily.set_index("date")
        .join(pomo_daily, how="left")
        .join(chk_daily, how="left")
        .reset_index()
    )

    # Make sure missing numeric fields are present
    for col in ["pomodoro_minutes", "focus_minutes", "alcohol_units", "sleep_hours", "energy"]:
        if col not in merged.columns:
            merged[col] = 0

    # Convert stalk_occurred to 0/1 for heatmap if present
    if "stalk_occurred" in merged.columns:
        merged["stalk_occurred_num"] = merged["stalk_occurred"].astype(bool).astype(int)
    else:
        merged["stalk_occurred"] = False
        merged["stalk_occurred_num"] = 0

    # -------------------------
    # Derived score (simple)
    # -------------------------
    merged["score"] = (
        merged.get("energy", 0).fillna(0) * 1.5
        + merged.get("sleep_hours", 0).fillna(0) * 1.0
        + (merged.get("pomodoro_minutes", 0).fillna(0) / 50.0) * 2.0
        + merged.get("focus_minutes", 0).fillna(0) / 60.0
        - merged.get("alcohol_units", 0).fillna(0) * 0.8
        - merged.get("stalk_intensity", 0).fillna(0) * 0.6
    ).round(2)

    merged["week"] = _week_id(pd.Series(merged["date"]))
    merged["month"] = _month_id(pd.Series(merged["date"]))

    # -------------------------
    # Weekly + Monthly aggregation
    # -------------------------
    weekly = (
        merged.groupby("week")
        .agg(
            days=("date", "count"),
            score_avg=("score", "mean"),
            sleep_avg=("sleep_hours", "mean"),
            energy_avg=("energy", "mean"),
            pomodoro_min=("pomodoro_minutes", "sum"),
            focus_min=("focus_minutes", "sum"),
            alcohol_units=("alcohol_units", "sum"),
            stalk_days=("stalk_occurred_num", "sum"),
            stalk_intensity_avg=("stalk_intensity", "mean"),
            feature_done_days=("feature_done", "sum"),
            trading_trades=("trading_trades", "sum"),
            game_commits=("game_commits", "sum"),
        )
        .reset_index()
    )

    monthly = (
        merged.groupby("month")
        .agg(
            days=("date", "count"),
            score_avg=("score", "mean"),
            sleep_avg=("sleep_hours", "mean"),
            energy_avg=("energy", "mean"),
            pomodoro_min=("pomodoro_minutes", "sum"),
            focus_min=("focus_minutes", "sum"),
            alcohol_units=("alcohol_units", "sum"),
            stalk_days=("stalk_occurred_num", "sum"),
            stalk_intensity_avg=("stalk_intensity", "mean"),
            feature_done_days=("feature_done", "sum"),
            trading_trades=("trading_trades", "sum"),
            game_commits=("game_commits", "sum"),
        )
        .reset_index()
    )

    # -------------------------
    # Weekly status (clear)
    # Based on your observed scale (daily ~12..26, weekly avg ~18.5)
    # -------------------------
    def weekly_status(avg: float) -> str:
        if pd.isna(avg):
            return "—"
        if avg >= 20:
            return "🟢 Excelente"
        if avg >= 16:
            return "🟡 Bien"
        if avg >= 12:
            return "🟠 Irregular"
        return "🔴 Mal"

    weekly["status"] = weekly["score_avg"].apply(weekly_status)

    # -------------------------
    # Heatmap data
    # -------------------------
    heat_cols = [
        "score",
        "energy",
        "sleep_hours",
        "pomodoro_minutes",
        "focus_minutes",
        "alcohol_units",
        "stalk_occurred_num",
        "stalk_intensity",
    ]
    heat = merged[["date"] + [c for c in heat_cols if c in merged.columns]].copy()
    heat = heat.set_index("date").sort_index()

    meta = {
        "timezone": tz,
        "generated_from": "excel_or_sheets",
        "rows_daily": int(len(merged)),
    }

    return KPIBundle(
        daily_table=merged.sort_values("date"),
        weekly_table=weekly.sort_values("week"),
        monthly_table=monthly.sort_values("month"),
        heatmap=heat,
        meta=meta,
    )
