# Diario Operativo Bot (Telegram + Google Sheets) + Reportes (HTML)

Bot de Telegram para registrar un **diario operativo** y generar **reportes semanales/mensuales** en HTML con análisis AI.
Pensado para ser simple, auditable y seguro (**sin credenciales en el repo**).

## 🌟 Features

### Bot (Apps Script)

- **Diario operativo**: Entradas diarias con 18 estados emocionales normalizados
- **Coach V3**: Sistema de 90 días con ciclos de 21 días, sprints semanales y plan diario personalizado
- **Ritual diario**: 4 afirmaciones personalizadas (una por categoría: núcleo, emocional, presencia, trabajo)
- **Check-ins inteligentes**: 3 preguntas diarias con selección anti-repetición basada en historial
- **Pomodoro laboral**: 25/5 x4 + 15, Lun–Vie 09:00–18:00
- **Recordatorios**: Plan matinal (08:30), 4 recordatorios aleatorios durante el día, cierre nocturno (22:30)

### Reportes (Python)

- **Dashboard HTML**: Visualización de progreso con heatmaps, KPIs y gráficos
- **Análisis AI**: Evaluación profunda de patrones emocionales, productividad y consistencia
- **Reportes semanales/mensuales**: Agregación y scoring automático
- **Validación de checkins**: Análisis de correlación pregunta-intensidad-respuesta

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

## 🚀 Novedades Recientes

### Enero 2026

- ✅ **Coach V3**: Sistema completo de 90 días con 4 ciclos de 21 días
- ✅ **Ritual mejorado**: 4 afirmaciones diarias (una por categoría) con caché diario
- ✅ **Check-ins inteligentes**: Sistema anti-repetición con historial
- ✅ **Mood normalizado**: 18 estados emocionales en español con mapeo automático
- ✅ **Auto-fill fecha**: El comando `/diario` pre-completa la fecha actual
- ✅ **Mensajes optimizados**: Formato mejorado para Telegram con emojis consistentes
- ✅ **Análisis AI profundo**: Evaluación mejorada de correlación pregunta-intensidad-respuesta en checkins
- ✅ **Horarios aleatorios**: Coach envía 4 recordatorios en horarios aleatorios durante el día

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
