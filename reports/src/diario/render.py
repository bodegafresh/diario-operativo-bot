from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict

import pandas as pd
from jinja2 import Environment, FileSystemLoader, select_autoescape

from .scoring import KPIBundle
from .viz import make_heatmap_png

def _env() -> Environment:
    templates_dir = Path(__file__).resolve().parent.parent / "templates"
    return Environment(
        loader=FileSystemLoader(str(templates_dir)),
        autoescape=select_autoescape(["html", "xml"]),
    )

def _to_records(df: pd.DataFrame, limit: int | None = None) -> list[dict[str, Any]]:
    if limit is not None:
        df = df.tail(limit)
    # Ensure json-serializable
    out = []
    for _, row in df.iterrows():
        rec = {}
        for k, v in row.items():
            if isinstance(v, (pd.Timestamp,)):
                rec[k] = v.isoformat()
            elif hasattr(v, "isoformat") and not isinstance(v, (str, int, float, bool)) and v is not None:
                try:
                    rec[k] = v.isoformat()
                except Exception:
                    rec[k] = str(v)
            elif pd.isna(v):
                rec[k] = None
            else:
                rec[k] = v
        out.append(rec)
    return out

def render_all(out_dir: Path, kpis: KPIBundle, data: Any, tz: str) -> None:
    env = _env()

    assets = out_dir / "assets"
    assets.mkdir(exist_ok=True, parents=True)

    # Heatmap image
    heatmap_path = assets / "heatmap.png"
    make_heatmap_png(kpis.heatmap, heatmap_path)

    # Index
    tpl = env.get_template("index.html.j2")
    html = tpl.render(
        meta=kpis.meta,
        tz=tz,
        heatmap_rel="assets/heatmap.png",
        daily=_to_records(kpis.daily_table, limit=30),
        weekly=_to_records(kpis.weekly_table),
        monthly=_to_records(kpis.monthly_table),
    )
    (out_dir / "index.html").write_text(html, encoding="utf-8")

    # Weekly pages
    weekly_tpl = env.get_template("period.html.j2")
    for w in kpis.weekly_table["week"].tolist():
        dfw = kpis.daily_table[kpis.daily_table["week"] == w].copy()
        page = weekly_tpl.render(
            title=f"Weekly report {w}",
            period=w,
            rows=_to_records(dfw),
        )
        (out_dir / f"weekly_{w}.html").write_text(page, encoding="utf-8")

    # Monthly pages
    for m in kpis.monthly_table["month"].tolist():
        dfm = kpis.daily_table[kpis.daily_table["month"] == m].copy()
        page = weekly_tpl.render(
            title=f"Monthly report {m}",
            period=m,
            rows=_to_records(dfm),
        )
        (out_dir / f"monthly_{m}.html").write_text(page, encoding="utf-8")
