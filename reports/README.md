# Reports (Python)

Genera reportes HTML (dashboard + weekly + monthly) desde tus tabs con análisis AI integrado:

- `Daily` → Entradas del diario operativo
- `Checkins` → Check-ins emocionales con intensidad
- `Pomodoro` → Sesiones de trabajo

## ✨ Features

### Visualización

- **Dashboard interactivo**: Heatmaps, KPIs y gráficos
- **Reportes semanales**: Agregación automática por semana
- **Reportes mensuales**: Vista panorámica del mes
- **Scores automáticos**: Cálculo de productividad y consistencia

### Análisis AI

- **Evaluación profunda**: Análisis de patrones emocionales y productividad
- **Insights de checkins**: Correlación pregunta-intensidad-respuesta
- **Validación de intensidad**: Identifica discrepancias entre respuesta y valor numérico
- **Evidencia respaldada**: Citas textuales de las entradas
- **Contra-movidas**: Recomendaciones específicas para mejorar (2-5 min de acción)

### Mejoras Técnicas (Enero 2026)

- ✅ Función `to_jsonable()` para serialización JSON robusta
- ✅ Supresión de warnings de numpy en operaciones vacías
- ✅ Corrección de campos en templates (counter_move_2_5_min)
- ✅ Sección de evidencia global en dashboard
- ✅ Análisis mejorado de correlación en checkins

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

## Ajustes y Personalización

### Scoring y Agregaciones

- **Archivo**: `src/diario/scoring.py`
- Personaliza fórmulas de score y agregaciones semanales/mensuales

### Plantillas HTML

- **Directorio**: `src/templates/*.j2`
- Personaliza el layout y diseño de los reportes

### Visualización (Heatmaps)

- **Archivo**: `src/diario/viz.py`
- Ajusta colores, escalas y estilos de gráficos

### Análisis AI

- **Archivo**: `src/diario/ai_prompt.py`
- Modifica el prompt para el análisis AI
- Ajusta instrucciones y énfasis del análisis

### Schema de Datos

- **Archivo**: `src/diario/ai_schema.py`
- Define estructura de datos para análisis AI
- Configura campos y validaciones

### Serialización JSON

- **Archivo**: `src/diario/json_safe.py`
- Manejo seguro de tipos especiales (numpy, pandas, dates)
- Conversión automática a tipos JSON serializables

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

## 🧪 Tests

```bash
# Ejecutar todos los tests
pytest -q

# Test específico de renderizado
pytest tests/test_render_smoke.py -v

# Con coverage
pytest --cov=src --cov-report=html
```

## 📊 Estructura del Análisis AI

### Campos Principales

- **topic**: Tema central identificado
- **score**: Puntuación del período (0-10)
- **counter_move_2_5_min**: Acción específica de 2-5 minutos para mejorar
- **evidence**: Lista de citas textuales que respaldan el análisis
- **insights**: Observaciones profundas sobre patrones

### Análisis de Checkins

- Correlación entre pregunta, intensidad y respuesta completa
- Validación de coherencia entre respuesta textual e intensidad numérica
- Identificación de patrones emocionales
- Énfasis en intensidades ≥7 (señales importantes)

### Output

Los reportes generan:

- `output/index.html` - Dashboard principal
- `output/weekly_YYYY-WWW.html` - Reportes semanales
- `output/monthly_YYYY-MM.html` - Reportes mensuales
- `output/assets/` - Datos JSON y recursos estáticos

## 🔧 Troubleshooting

### Error: ModuleNotFoundError

```bash
# Verifica que estés en el entorno virtual
source .venv/bin/activate

# Reinstala dependencias
uv pip install -r requirements.txt
```

### Error: Google Sheets API

```bash
# Verifica credenciales
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json

# Verifica que el Service Account tenga acceso al Sheet
# Comparte el Sheet con el email del SA
```

### Warnings de NumPy

Los warnings de "mean of empty slice" están suprimidos automáticamente en `viz.py` cuando no hay datos para un período específico.
