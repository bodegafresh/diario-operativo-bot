from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pandas as pd


def json_safe(obj: Any) -> Any:
    """
    Convert objects into JSON-serializable structures.
    - datetime/date -> isoformat string
    - pandas types -> python primitives
    - NaN/NA -> None
    """
    # pandas NA / NaN
    try:
        if pd.isna(obj):
            return None
    except Exception:
        pass

    # datetime/date
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()

    # pandas Timestamp
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()

    # pandas scalar types
    if isinstance(obj, (pd.Int64Dtype, pd.Float64Dtype)):
        return None

    # primitives
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj

    # dict
    if isinstance(obj, dict):
        return {str(k): json_safe(v) for k, v in obj.items()}

    # list/tuple
    if isinstance(obj, (list, tuple)):
        return [json_safe(x) for x in obj]

    # fallback
    return str(obj)


def df_to_records_json_safe(df: pd.DataFrame, limit: int | None = None) -> list[dict[str, Any]]:
    """
    DataFrame -> list[dict] but JSON-safe.
    """
    if df is None or df.empty:
        return []

    out_df = df.copy()
    if limit is not None:
        out_df = out_df.tail(limit)

    records: list[dict[str, Any]] = []
    for _, row in out_df.iterrows():
        rec = {}
        for k, v in row.items():
            rec[str(k)] = json_safe(v)
        records.append(rec)
    return records
