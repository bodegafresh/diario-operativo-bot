# src/diario/ai_schema.py
from __future__ import annotations

AI_INSIGHTS_SCHEMA_EXAMPLE = {
    "theme": "string (tema central de la semana)",
    "evidence": {
        "checkins_quotes": [
            "short quote from answers (<= 140 chars)",
        ],
        "diary_quotes": [
            "short quote from notes (<= 140 chars)",
        ],
    },
    "checkins_deep_dive": {
        "top_loops": [
            {
                "loop": "pensamiento recurrente (1 frase)",
                "emotion": "emoción dominante",
                "trigger": "disparador típico",
                "body_signal": "señal corporal si aparece",
                "evidence_quote": "1 cita corta",
                "reframe": "reencuadre útil",
                "micro_action_2min": "acción ejecutable en 2 minutos",
            }
        ],
        "top_triggers": [
            {
                "trigger": "gatillante",
                "pattern": "cómo se manifiesta",
                "countermove": "qué hacer en 90s",
            }
        ],
        "questions_summary": [
            {
                "question": "pregunta del checkin",
                "count": 3,
                "avg_intensity": 6.2,
                "dominant_topics": ["ansiedad", "anticipación"],
            }
        ],
    },
    "daily_patterns": {
        "sleep_energy": "insight",
        "alcohol_stalk": "insight",
        "focus_work": "insight",
    },
    "wins": [
        {"title": "victoria", "why_it_matters": "breve"},
    ],
    "bottlenecks": [
        {"title": "cuello de botella", "root_cause": "causa probable", "fix": "ajuste"},
    ],
    "next_week_rules": [
        {
            "rule": "regla clara",
            "why": "por qué",
            "threshold": "métrica/criterio",
        }
    ],
    "if_i_fail_then": [
        {
            "signal": "señal de que estás cayendo",
            "then": "plan de contingencia (simple)",
        }
    ],
    "identity_line": "1 frase identidad operativa",
}
