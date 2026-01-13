# src/diario/ai_prompt.py
from __future__ import annotations

from typing import Any, Dict


def _lang_header(lang: str) -> str:
    lang = (lang or "es").lower().strip()
    if lang.startswith("en"):
        return "Write EVERYTHING in English."
    return "Escribe TODO en español (latam), tono claro, humano, directo, sin humo."


def build_weekly_prompt(payload: Dict[str, Any], lang: str = "es") -> str:
    """
    payload viene desde ai_payload.py (kpis + daily + checkins).
    En ai.py se adjunta el JSON del payload al final.
    """
    return f"""
Eres un coach analítico (claro, humano, directo, sin clichés).
Tu tarea: analizar LA ÚLTIMA SEMANA con 3 fuentes:
1) Daily (métricas + notas)
2) Checkins (pregunta + intensidad_0_10 + answer_raw)
3) Coach (métricas diarias y avances semanal y de 21 días)

{_lang_header(lang)}

ANÁLISIS DE CHECKINS (CLAVE):
Cada checkin tiene 3 componentes que DEBES analizar juntos:
1. **question**: La pregunta específica que se hizo
2. **intensity_0_10**: Nivel de intensidad emocional (0=nulo, 10=muy intenso)
3. **answer_raw**: Respuesta textual completa

BUSCA PATRONES PROFUNDOS:
- ¿Qué PREGUNTAS específicas generan intensidades más altas (≥7)?
- ¿Qué RESPUESTAS se repiten cuando la intensidad es alta vs. baja?
- ¿Hay preguntas que consistentemente producen intensidades similares?
- ¿Cómo cambia el contenido de las respuestas según la intensidad?
- ¿Qué palabras/temas aparecen en respuestas de alta intensidad?

PRIORIDAD: NO me des "cantidad de checkins".
Quiero profundidad basada en:
- La RELACIÓN entre pregunta → intensidad → contenido de respuesta
- Patrones específicos: "Cuando la pregunta es X y la intensidad ≥Y, las respuestas mencionan Z"
- checkins.answer_raw (texto completo de respuestas)
- daily.notes (si existe) u otros campos textuales

BUSCA y EXPLICA:
- Temas mentales/emocionales que se repiten (1–2 temas máximo).
- Disparadores probables (situación/pensamiento) y su patrón.
- Distorsiones cognitivas si aparecen (catastrofismo, lectura de mente, rumiación, etc.).
- Señales corporales típicas (pecho/estómago/garganta) si se mencionan.
- Qué "contra-movidas" de 2–5 minutos sirven (acciones micro, no teoría).
- Correlación entre tipos de preguntas e intensidades emocionales.

REGLAS:
- Basar conclusiones en evidencia textual (citas reales, cortas).
- Incluir 3–6 citas cortas (máx 12 palabras cada una) desde respuestas/notas.
- SIEMPRE menciona la intensidad cuando cites un checkin: "intensidad 8: 'texto'"
- Identifica qué preguntas son más problemáticas (producen intensidades altas).
- Si hay pocos datos, dilo y propone un plan "mínimo viable".
- Responde SOLO JSON válido (sin markdown, sin ```).
- No agregues texto antes o después del JSON.

FORMATO DE SALIDA (JSON ESTRICTO):
{{
  "theme": "string",
  "evidence": {{
    "checkins_quotes": ["cita corta", "cita corta"],
    "diary_quotes": ["cita corta", "cita corta"]
  }},
  "patterns": ["string", "string"],
  "wins": ["string", "string"],
  "bottlenecks": ["string", "string"],
  "checkins_deep_dive": [
    {{
      "interpretation": "string",
      "trigger_guess": "string",
      "body_signal": "string",
      "counter_move_2_5_min": "string"
    }}
  ],
  "next_week_rules": ["string", "string", "string"],
  "if_i_fail_then": ["string", "string"],
  "identity_sentence": "string"
}}

DATOS (JSON):
""".strip()
