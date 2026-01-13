# src/diario/ai.py
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Optional

from .ai_payload import build_weekly_ai_payload
from .ai_prompt import build_weekly_prompt
from .json_safe import dumps as json_dumps_safe
from .json_safe import loads as json_loads_safe


def _call_openai(prompt: str, model: str, api_key: str, lang: str = "es") -> str:
    """
    Compatible con openai>=1.x usando Chat Completions.
    NO usa response_format para evitar el error que viste.
    Fuerza idioma también por system para reducir respuestas en inglés.
    """
    from openai import OpenAI  # lazy import

    client = OpenAI(api_key=api_key)

    lang = (lang or "es").lower().strip()
    sys_lang = (
        "You MUST write EVERYTHING in English."
        if lang.startswith("en")
        else "Debes escribir TODO en español (latam)."
    )

    resp = client.chat.completions.create(
        model=model,
        temperature=0.2,
        messages=[
            {"role": "system", "content": f"Eres un asistente útil. {sys_lang}"},
            {"role": "user", "content": prompt},
        ],
    )
    return (resp.choices[0].message.content or "").strip()


def generate_weekly_ai_insights(
    kpis: Any,
    data_bundle: Any,
    tz: str,
    weeks_back: int = 0,
    out_dir: Optional[Path] = None,
    lang: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Genera un JSON semanal y lo guarda en:
      {out_dir}/assets/ai_weekly.json
    """
    api_key = os.getenv("OPENAI_API_KEY", "")
    model = os.getenv("OPENAI_MODEL", "gpt-4o")

    # Idioma parametrizable por env
    lang = (lang or os.getenv("AI_LANG", "es")).strip() or "es"

    if not api_key:
        raise ValueError("Missing OPENAI_API_KEY in environment.")

    payload = build_weekly_ai_payload(
        kpis=kpis,
        data_bundle=data_bundle,
        tz=tz,
        weeks_back=weeks_back,
    )

    # Prompt + datos serializados seguro (date/Timestamp/etc.)
    prompt = build_weekly_prompt(payload=payload, lang=lang) + "\n" + json_dumps_safe(payload)

    raw = _call_openai(prompt=prompt, model=model, api_key=api_key, lang=lang)

    # Parse robusto (soporta ```json ...```, texto con JSON embebido, etc.)
    try:
        parsed = json_loads_safe(raw)
    except Exception:
        # fallback visible pero no rompe render
        parsed = {
            "theme": "Respuesta no-JSON",
            "evidence": {"checkins_quotes": [], "diary_quotes": []},
            "patterns": [raw[:220]] if raw else [],
            "wins": [],
            "bottlenecks": [],
            "checkins_deep_dive": [],
            "next_week_rules": [],
            "if_i_fail_then": [],
            "identity_sentence": "",
        }

    # save
    if out_dir is not None:
        assets = Path(out_dir) / "assets"
        assets.mkdir(parents=True, exist_ok=True)
        (assets / "ai_weekly.json").write_text(
            json_dumps_safe(parsed, indent=2),
            encoding="utf-8",
        )

    return parsed
