from __future__ import annotations

import json
import re
import datetime as _dt
from typing import Any, Optional

try:
    import pandas as pd  # type: ignore
except Exception:  # pragma: no cover
    pd = None  # type: ignore

try:
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover
    np = None  # type: ignore


def _default(o: Any) -> Any:
    """
    Convierte objetos no-JSON a algo serializable:
    - date/datetime -> isoformat
    - pandas Timestamp -> isoformat
    - numpy scalars -> python scalars
    """
    if isinstance(o, (_dt.datetime, _dt.date)):
        return o.isoformat()

    if pd is not None:
        ts = getattr(pd, "Timestamp", None)
        if ts is not None and isinstance(o, ts):
            return o.isoformat()

    if np is not None:
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating,)):
            return float(o)
        if isinstance(o, (np.bool_,)):
            return bool(o)

    # fallback
    return str(o)


def dumps(obj: Any, **kwargs: Any) -> str:
    """
    json.dumps seguro (no revienta con date, Timestamp, numpy, etc.)
    """
    return json.dumps(
        obj,
        ensure_ascii=kwargs.pop("ensure_ascii", False),
        indent=kwargs.pop("indent", None),
        default=kwargs.pop("default", _default),
        **kwargs,
    )


def _strip_code_fences(text: str) -> str:
    # Quita ```json ... ``` o ``` ... ```
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def extract_json(text: str) -> Optional[str]:
    """
    Intenta extraer el primer objeto JSON {...} o array [...] dentro de un texto.
    Soporta respuestas del modelo con fences ```json ...```.
    """
    if not text:
        return None

    text = _strip_code_fences(text)

    # 1) Si ya es JSON limpio
    t0 = text.strip()
    if (t0.startswith("{") and t0.endswith("}")) or (t0.startswith("[") and t0.endswith("]")):
        return t0

    # 2) Buscar bloque { ... } más externo (heurística simple)
    start_obj = t0.find("{")
    end_obj = t0.rfind("}")
    if start_obj != -1 and end_obj != -1 and end_obj > start_obj:
        return t0[start_obj : end_obj + 1].strip()

    # 3) Buscar bloque [ ... ]
    start_arr = t0.find("[")
    end_arr = t0.rfind("]")
    if start_arr != -1 and end_arr != -1 and end_arr > start_arr:
        return t0[start_arr : end_arr + 1].strip()

    return None


def loads(text: str) -> Any:
    """
    json.loads seguro: si viene texto con basura alrededor, intenta extraer JSON.
    """
    if text is None:
        raise ValueError("loads() recibió None")

    raw = str(text)
    candidate = extract_json(raw)
    if candidate is None:
        raise ValueError("No se pudo extraer JSON de la respuesta")

    return json.loads(candidate)


def to_jsonable(obj: Any) -> Any:
    """
    Convierte recursivamente un objeto a una estructura JSON-serializable.
    Usa _default() para convertir tipos especiales (dates, numpy, pandas, etc.)
    """
    if obj is None or isinstance(obj, (bool, int, float, str)):
        return obj

    if isinstance(obj, dict):
        return {k: to_jsonable(v) for k, v in obj.items()}

    if isinstance(obj, (list, tuple)):
        return [to_jsonable(item) for item in obj]

    # Para otros tipos, usa _default()
    return _default(obj)
