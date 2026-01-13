from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any

import pandas as pd

from .loaders import DataBundle


def _coerce_date(df: pd.DataFrame, col: str = "date") -> pd.Series:
    return pd.to_datetime(df[col], errors="coerce").dt.date


def _week_id(d: pd.Series) -> pd.Series:
    dtidx = pd.to_datetime(d.astype(str), errors="coerce")
    iso = dtidx.dt.isocalendar()
    return iso["year"].astype(str) + "-W" + iso["week"].astype(str).str.zfill(2)


def _month_id(d: pd.Series) -> pd.Series:
    dtidx = pd.to_datetime(d.astype(str), errors="coerce")
    return dtidx.dt.strftime("%Y-%m")


def _col(merged: pd.DataFrame, name: str, default: float = 0.0) -> pd.Series:
    if name in merged.columns:
        return pd.to_numeric(merged[name], errors="coerce").fillna(default)
    return pd.Series([default] * len(merged), index=merged.index)


@dataclass
class KPIBundle:
    daily_table: pd.DataFrame
    weekly_table: pd.DataFrame
    monthly_table: pd.DataFrame
    heatmap: pd.DataFrame
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

    bool_map = {
        "true": True,
        "false": False,
        "1": True,
        "0": False,
        "yes": True,
        "no": False,
        "si": True,
        "sí": True,
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

    # stalk intensity label + numeric
    if "stalk_intensity" in daily.columns:
        daily["stalk_intensity_label"] = (
            daily["stalk_intensity"]
            .astype(str)
            .str.strip()
            .str.lower()
            .replace({"": None, "none": None, "nan": None})
        )
        intensity_map = {None: 0, "low": 1, "mid": 2, "medium": 2, "high": 3}
        daily["stalk_intensity"] = daily["stalk_intensity_label"].map(intensity_map)

        if "stalk_occurred" in daily.columns:
            daily.loc[
                (daily["stalk_occurred"] == True) & (daily["stalk_intensity"].isna()),
                "stalk_intensity",
            ] = 1

        daily["stalk_intensity"] = pd.to_numeric(daily["stalk_intensity"], errors="coerce").fillna(0)
    else:
        daily["stalk_intensity_label"] = None
        daily["stalk_intensity"] = 0

    # -------------------------
    # Pomodoro: minutes per day
    # -------------------------
    pomo = data.pomodoro.copy()
    if "date" in pomo.columns:
        pomo["date"] = _coerce_date(pomo, "date")
        pomo = pomo.dropna(subset=["date"])
    else:
        pomo = pd.DataFrame(columns=["date", "event", "phase", "cycle"])

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
        chk = pd.DataFrame(columns=["date", "question", "intensity_0_10", "answer_raw"])

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
    # Coach: per-day metrics (score_0_6, impulses_count)
    # -------------------------
    coach = data.coach.copy()
    if coach is None or coach.empty or "date" not in coach.columns:
        coach_daily = pd.DataFrame(columns=["coach_score", "coach_impulses", "coach_alcohol_days"])
    else:
        coach["date"] = _coerce_date(coach, "date")
        coach = coach.dropna(subset=["date"])

        # names from your Coach sheet
        if "score_0_6" in coach.columns:
            coach["score_0_6"] = pd.to_numeric(coach["score_0_6"], errors="coerce")
        if "impulses_count" in coach.columns:
            coach["impulses_count"] = pd.to_numeric(coach["impulses_count"], errors="coerce")

        # alcohol can be boolish
        if "alcohol_bool" in coach.columns:
            coach["alcohol_bool"] = (
                coach["alcohol_bool"]
                .astype(str).str.strip().str.lower()
                .map({"true": True, "false": False, "1": True, "0": False, "si": True, "sí": True, "no": False})
                .fillna(False)
            )
        else:
            coach["alcohol_bool"] = False

        coach_daily = coach.groupby("date").agg(
            coach_score=("score_0_6", "mean"),
            coach_impulses=("impulses_count", "sum"),
            coach_alcohol_days=("alcohol_bool", "sum"),
        )

    # -------------------------
    # Merge daily + pomo + checkins + coach
    # -------------------------
    merged = (
        daily.set_index("date")
        .join(pomo_daily, how="left")
        .join(chk_daily, how="left")
        .join(coach_daily, how="left")
        .reset_index()
    )

    # ensure numeric cols exist
    for col in ["pomodoro_minutes", "focus_minutes", "alcohol_units", "sleep_hours", "energy", "coach_score", "coach_impulses"]:
        if col not in merged.columns:
            merged[col] = 0

    # stalk occurred numeric
    if "stalk_occurred" in merged.columns:
        merged["stalk_occurred_num"] = merged["stalk_occurred"].astype(bool).astype(int)
    else:
        merged["stalk_occurred"] = False
        merged["stalk_occurred_num"] = 0

    # -------------------------
    # Derived score (simple)
    # -------------------------
    merged["score"] = (
        _col(merged, "energy") * 1.5
        + _col(merged, "sleep_hours") * 1.0
        + (_col(merged, "pomodoro_minutes") / 50.0) * 2.0
        + _col(merged, "focus_minutes") / 60.0
        - _col(merged, "alcohol_units") * 0.8
        - _col(merged, "stalk_intensity") * 0.6
        + (_col(merged, "coach_score") / 6.0) * 2.0
        - _col(merged, "coach_impulses") * 0.3
    ).round(2)

    merged["week"] = _week_id(pd.Series(merged["date"]))
    merged["month"] = _month_id(pd.Series(merged["date"]))

    # Weekly aggregation
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
            feature_done_days=("feature_done", "sum") if "feature_done" in merged.columns else ("date", "count"),
            trading_trades=("trading_trades", "sum") if "trading_trades" in merged.columns else ("date", "count"),
            game_commits=("game_commits", "sum") if "game_commits" in merged.columns else ("date", "count"),
            coach_score_avg=("coach_score", "mean"),
            coach_impulses=("coach_impulses", "sum"),
            checkins_count=("checkins_count", "sum") if "checkins_count" in merged.columns else ("date", "count"),
            checkins_intensity_avg=("checkins_intensity_avg", "mean") if "checkins_intensity_avg" in merged.columns else ("score", "mean"),
        )
        .reset_index()
    )

    # Monthly aggregation
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
            feature_done_days=("feature_done", "sum") if "feature_done" in merged.columns else ("date", "count"),
            trading_trades=("trading_trades", "sum") if "trading_trades" in merged.columns else ("date", "count"),
            game_commits=("game_commits", "sum") if "game_commits" in merged.columns else ("date", "count"),
            coach_score_avg=("coach_score", "mean"),
            coach_impulses=("coach_impulses", "sum"),
            checkins_count=("checkins_count", "sum") if "checkins_count" in merged.columns else ("date", "count"),
            checkins_intensity_avg=("checkins_intensity_avg", "mean") if "checkins_intensity_avg" in merged.columns else ("score", "mean"),
        )
        .reset_index()
    )

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

    # Heatmap
    heat_cols = [
        "score",
        "energy",
        "sleep_hours",
        "pomodoro_minutes",
        "focus_minutes",
        "alcohol_units",
        "stalk_occurred_num",
        "stalk_intensity",
        "coach_score",
        "coach_impulses",
        "checkins_intensity_avg",
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
