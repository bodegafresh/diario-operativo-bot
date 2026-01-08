#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path

from diario.loaders import load_data
from diario.scoring import build_kpis
from diario.render import render_all
from dotenv import load_dotenv
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

    render_all(out_dir=out_dir, kpis=kpis, data=data, tz=args.tz)
    print(f"✅ Reports generated in: {out_dir.resolve()}")
    print(f"Open: {out_dir.resolve() / 'index.html'}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
