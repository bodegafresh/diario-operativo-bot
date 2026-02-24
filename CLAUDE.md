# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal productivity system composed of two independent subsystems:

1. **Apps Script Bot** — A Telegram bot (Google Apps Script) for daily diary, emotional check-ins, Coach V3 (90-day program), and Pomodoro tracking. Data is stored in Google Sheets.
2. **Python Reports** — An offline reporting engine that reads from Excel or Google Sheets and generates HTML dashboards with optional AI analysis (OpenAI).

## Repository Structure

```
apps-script/        # Google Apps Script (Telegram bot backend)
  src/              # .gs source files pushed via clasp
reports/            # Python reporting engine
  src/cli.py        # Entry point: python -m src.cli
  src/diario/       # Core modules (loaders, scoring, render, ai*)
  tests/            # pytest
  output/           # Generated HTML (git-ignored)
```

## Common Commands

### Apps Script

```bash
# Install clasp globally
npm i -g @google/clasp
clasp login

# Push code to Apps Script
cd apps-script
clasp push
```

Deployment is manual: in the Apps Script UI → Deploy → New deployment → Web App. After deploying, run `run_setWebhookToWorker()` from the IDE to register the Telegram webhook.

### Python Reports

```bash
cd reports
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt

# Run with Excel source (no credentials needed)
python -m src.cli --source excel --excel path/to/file.xlsx --out output

# Run with Google Sheets source
python -m src.cli --source sheets --ai on --out output

# Run tests
pytest -q
pytest tests/test_render_smoke.py -v
```

## Architecture

### Apps Script Flow

```
Telegram → (Cloudflare Worker proxy, optional) → doPost() in telegram.gs
  → handleMessage_() → command/reply router
  → appends rows to Google Sheets tabs (Daily, Checkins, Pomodoro, Coach, CoachState)
```

Key files:
- [telegram.gs](apps-script/src/telegram.gs) — webhook entry point `doPost()`, command dispatcher
- [config.gs](apps-script/src/config.gs) — `PROP`, `SHEETS`, `DEFAULTS` constants; `cfgGet_/cfgSet_()` for Script Properties
- [coach.gs](apps-script/src/coach.gs) — Coach V3: 90-day / 4-cycle program, rituals, `/coach`, `/ritual`, `/plan`, `/nivel`, `/entreno`
- [coach_state.gs](apps-script/src/coach_state.gs) — Coach state persisted in `CoachState` Sheets tab (migrated from Properties)
- [diary.gs](apps-script/src/diary.gs) — `/diario` command, pipe/colon-separated parser, 18 normalized mood options
- [checkins.gs](apps-script/src/checkins.gs) — 3 daily check-ins, anti-repetition pool of 10 questions, intensity 0-10 parser
- [pomodoro.gs](apps-script/src/pomodoro.gs) — 25/5×4+15 min cycle, state in Script Properties, Mon-Fri 09:00-18:00
- [openai.gs](apps-script/src/openai.gs) — Optional OpenAI integration for coach responses

### Python Reports Flow

```
cli.py → loaders.py (DataBundle) → scoring.py (KPIBundle) → [ai.py (optional)] → render.py → HTML output
```

Key files:
- [src/cli.py](reports/src/cli.py) — CLI argument parsing with `.env` fallback
- [src/diario/loaders.py](reports/src/diario/loaders.py) — `DataBundle` dataclass; reads Excel or Google Sheets via gspread
- [src/diario/scoring.py](reports/src/diario/scoring.py) — `KPIBundle`; weekly/monthly aggregations, 0-10 scoring
- [src/diario/render.py](reports/src/diario/render.py) — Jinja2 HTML rendering (`index.html.j2`, `period.html.j2`)
- [src/diario/ai.py](reports/src/diario/ai.py) — OpenAI weekly analysis → `output/assets/ai_weekly.json`
- [src/diario/viz.py](reports/src/diario/viz.py) — Z-score normalized heatmap PNG (matplotlib)

### Google Sheets Schema

| Tab | Purpose |
|-----|---------|
| `Daily` | Diary entries (sleep, energy, mood, focus, training, alcohol, etc.) |
| `Checkins` | Emotional check-ins (date, time, question, intensity_0_10, answer_raw) |
| `Pomodoro` | Work sessions (date, time, event, phase, cycle) |
| `Coach` | Coach plan (sprint_theme, objectives, exercises) |
| `CoachState` | Coach runtime state (enabled, level, cycle_day, affirmations_cache) |

Run `setup()` from Apps Script to create all tabs and triggers.

## Configuration

### Apps Script — Script Properties (set in Apps Script UI)

| Key | Required | Description |
|-----|----------|-------------|
| `BOT_TOKEN` | YES | Telegram bot token |
| `SPREADSHEET_ID` | YES | Google Sheets ID |
| `WEBAPP_URL` | YES | Apps Script web app URL |
| `WORKER_URL` | NO | Cloudflare Worker proxy URL |
| `TG_WEBHOOK_SECRET` | NO | Webhook security token |
| `OPENAI_API_KEY` | NO | For AI-powered coach responses |

### Python Reports — `.env` (copy from `.env.example`)

```bash
SOURCE=excel|sheets
EXCEL_PATH=../diario\ operativo.xlsx   # if SOURCE=excel
GOOGLE_SHEETS_SPREADSHEET_ID=...       # if SOURCE=sheets
GOOGLE_APPLICATION_CREDENTIALS=...    # service account JSON path
TIMEZONE=America/Santiago
AI=on|off
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
AI_LANG=es
AI_WEEKS_BACK=4
```
