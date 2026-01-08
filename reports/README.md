# Reports (Python)

Genera reportes HTML (dashboard + weekly + monthly) desde tus tabs:

- `Daily`
- `Checkins`
- `Pomodoro`

## Quickstart

```bash
cd reports
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# usando Excel (fixture o tu export)
python -m src.cli --source excel --excel-path "../diario operativo.xlsx" --out output

open output/index.html
```

## Ajustes

- Fórmula de score y agregaciones: `src/diario/scoring.py`
- Plantillas HTML: `src/templates/*.j2`
- Heatmap: `src/diario/viz.py`


## Usar Google Sheets (lo recomendado)

### 1) Crea un Service Account (GCP)
- Crea un proyecto en Google Cloud
- Habilita Google Sheets API (y Drive API opcional)
- Crea un Service Account y descarga el JSON

### 2) Comparte tu Google Sheet con el email del Service Account
En Google Sheets: Share → agrega `xxx@yyy.iam.gserviceaccount.com` con permiso Viewer.

### 3) Variables de entorno
Crea `.env` (no se commitea) o exporta variables:

- `GOOGLE_SHEETS_SPREADSHEET_ID=<ID>`
- `GOOGLE_APPLICATION_CREDENTIALS=/ruta/sa.json`

### 4) Ejecuta
```bash
python -m src.cli --source sheets --out output
open output/index.html
```
