# src/diario/ai_schema.py
from __future__ import annotations

AI_INSIGHTS_SCHEMA_EXAMPLE = {
    "theme": "string (tema central de la semana)",
    "week_comparison": {
        "improvements": [
            "métrica: valor_anterior → valor_actual (+delta) - explicación breve"
        ],
        "regressions": [
            "métrica: valor_anterior → valor_actual (-delta) - explicación breve"
        ],
        "maintained_patterns": [
            "patrón que se mantiene consistente entre semanas"
        ],
    },
    "evidence": {
        "checkins_quotes": [
            "short quote from answers (<= 140 chars)",
        ],
        "diary_quotes": [
            "short quote from notes (<= 140 chars)",
        ],
    },
    "checkins_deep_dive": [
        {
            "interpretation": "Loop mecánico: Cuando [situación] → pienso/hago [X] → pierdo [Y tiempo/foco]",
            "trigger_guess": "Disparador concreto (situación/pensamiento/frase interna específica)",
            "body_signal": "Señal corporal clara (estómago/pecho/garganta/manos/respiración)",
            "counter_move_2_5_min": "Acción específica: Cuando [X], hacer [Y], esperar [Z]",
        },
        # TODOS los campos son obligatorios
        # Máximo 2-3 loops distintos (no variantes del mismo)
        # Si no hay datos suficientes, genera MENOS deep dives pero COMPLETOS
    ],
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
