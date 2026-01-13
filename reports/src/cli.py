#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv

from diario.loaders import load_data
from diario.scoring import build_kpis
from diario.render import render_all

load_dotenv()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate Diario Operativo HTML reports")

    p.add_argument("--source", choices=["excel", "sheets"], default=os.getenv("SOURCE", "excel"))

    # Excel
    p.add_argument("--excel-path", default=os.getenv("EXCEL_PATH", "diario operativo.xlsx"))

    # Sheets (Service Account)
    p.add_argument("--spreadsheet-id", default=os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID"))
    p.add_argument("--creds", default=os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))

    p.add_argument("--out", default=os.getenv("OUT_DIR", "output"))
    p.add_argument("--tz", default=os.getenv("TIMEZONE", "America/Santiago"))

    # AI
    p.add_argument("--ai", choices=["on", "off"], default=os.getenv("AI", "off"))
    p.add_argument("--ai-weeks-back", type=int, default=int(os.getenv("AI_WEEKS_BACK", "0")))
    p.add_argument("--ai-lang", default=os.getenv("AI_LANG", "es"))

    return p.parse_args()


def main() -> int:
    args = parse_args()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    data = load_data(
        source=args.source,
        excel_path=args.excel_path,
        spreadsheet_id=args.spreadsheet_id,
        creds_path=args.creds,
    )

    kpis = build_kpis(data, tz=args.tz)

    if args.ai == "on":
        from diario.ai import generate_weekly_ai_insights

        generate_weekly_ai_insights(
            kpis=kpis,
            data_bundle=data,
            tz=args.tz,
            weeks_back=args.ai_weeks_back,
            out_dir=out_dir,
            lang=args.ai_lang,
        )

    render_all(out_dir=out_dir, kpis=kpis, data=data, tz=args.tz)

    print(f"✅ Reports generated in: {out_dir.resolve()}")
    print(f"Open: {out_dir.resolve() / 'index.html'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
