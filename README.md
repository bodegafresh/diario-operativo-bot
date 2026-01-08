# Diario Operativo Bot (Telegram + Google Sheets) + Reportes (HTML)

Bot de Telegram para registrar un **diario operativo** y generar **reportes semanales/mensuales** en HTML.  
Pensado para ser simple, auditable y seguro (**sin credenciales en el repo**).

## Nombre sugerido del repositorio

**`diario-operativo-bot`**

Alternativas (por si quieres algo más “marca”):
- `operational-diary`
- `rebuild-protocol-bot`
- `diario-operativo-dashboard`

---

## Features

- Entradas diarias (modo “diario operativo”) guardadas en Google Sheets.
- Recordatorio nocturno para completar el diario.
- 3 check-ins aleatorios diarios (inspirados en “Deja de ser tú”).
- Pomodoro laboral (Chile): 25/5 x4 + 15, L–V 09:00–18:00.
- Reportes HTML: weekly / monthly / dashboard index (heatmap + KPIs).

## Estructura del repo

- `apps-script/` → Bot y lógica de triggers: diario, checkins, pomodoro, scheduler.
- `reports/` → CLI Python para generar HTML desde Google Sheets (y opcionalmente desde `.md`).
- `.github/workflows/` → CI para tests del generador de reportes.

## Seguridad (importante)

Este repo **NO** incluye tokens ni credenciales.

- Apps Script usa **Script Properties**:
  - `TELEGRAM_BOT_TOKEN`
  - `SPREADSHEET_ID`
  - `WEBAPP_URL`
  - (opcional) `TIMEZONE=America/Santiago`

- Reportes usan `.env` local y/o credenciales GCP fuera del repo.

Lee `SECURITY.md` antes de usar o contribuir.

---

## Quickstart (macOS)

### 1) Apps Script (bot)

**Requisitos**
- Node.js
- clasp

**Instalar**
```bash
brew install node
npm i -g @google/clasp
clasp login
```

**Subir código**
```bash
cd apps-script
clasp push
```

**Configurar Script Properties (en Apps Script UI)**
1. Abre el proyecto en el editor de Apps Script.
2. Project Settings → Script Properties
3. Agrega:
   - `TELEGRAM_BOT_TOKEN`
   - `SPREADSHEET_ID`

**Deploy como WebApp + webhook**
1. Deploy → New deployment → Web app  
   - Execute as: **Me**
   - Who has access: **Anyone**
2. Copia la URL del deploy y guárdala como Script Property: `WEBAPP_URL`
3. Ejecuta la función `setWebhook()` desde el editor Apps Script.

> Tip: configura la zona horaria del proyecto como `America/Santiago` (Project Settings).

---

### 2) Reportes (Python)

**Requisitos**
- Python 3.11+
- (recomendado) `uv`

**Instalar**
```bash
brew install uv
cd reports
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env
```

**Generar reportes**
```bash
python -m src.cli --source sheets --out output
open output/index.html
```

**Tests**
```bash
pytest -q
```

---

## Variables y archivos sensibles

### `.env` (local, NO se commitea)

Crea tu `.env` desde el ejemplo:

```bash
cp .env.example .env
```

### Script Properties (Apps Script)

Se configuran desde la UI de Apps Script.  
**Nunca** pongas tokens en el código ni en commits.

---

## Contribuir

PRs bienvenidos:
- mejoras de parser y normalización
- nuevos KPIs y visualizaciones
- robustez de triggers (idempotencia, locks)
- documentación y ejemplos

## Licencia

MIT
