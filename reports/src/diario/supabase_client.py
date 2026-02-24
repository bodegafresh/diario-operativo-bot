"""
supabase_client.py
Cliente HTTP mínimo para PostgREST de Supabase.

Patrón idéntico al de trading-journal/src/trade_journal/data/supabase_client.py:
- requests.Session con HTTPAdapter + urllib3.Retry
- Pool de 20 conexiones, keep-alive
- 6 reintentos con backoff exponencial en 429/500/502/503/504
- Timeouts (5s connect, 30s read)

Variables de entorno requeridas:
    SUPABASE_URL         → https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY → eyJ...  (service_role key)
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


@dataclass(frozen=True)
class SupabaseConfig:
    url: str
    key: str
    schema: str = "public"
    timeout: Tuple[float, float] = (5.0, 30.0)
    pool_connections: int = 20
    pool_maxsize: int = 20
    retries_total: int = 6
    backoff_factor: float = 0.5


def _build_retry(cfg: SupabaseConfig) -> Retry:
    return Retry(
        total=cfg.retries_total,
        connect=cfg.retries_total,
        read=cfg.retries_total,
        status=cfg.retries_total,
        backoff_factor=cfg.backoff_factor,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "POST", "PATCH", "DELETE"]),
        raise_on_status=False,
        respect_retry_after_header=True,
    )


class SupabaseClient:
    """Cliente mínimo para PostgREST de Supabase (HTTP directo, sin supabase-py)."""

    def __init__(self, cfg: SupabaseConfig):
        self.cfg = cfg
        self.base = cfg.url.rstrip("/") + "/rest/v1"

        # Session + retry + pool (evita RemoteDisconnected y reduce overhead)
        self.session = requests.Session()
        adapter = HTTPAdapter(
            max_retries=_build_retry(cfg),
            pool_connections=cfg.pool_connections,
            pool_maxsize=cfg.pool_maxsize,
        )
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

        self.session.headers.update(
            {
                "apikey": cfg.key,
                "Authorization": f"Bearer {cfg.key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-Profile": cfg.schema,
                "Connection": "keep-alive",
            }
        )

    def _url(self, table: str) -> str:
        return f"{self.base}/{table}"

    _PAGE_SIZE = 1000  # max_rows por defecto en Supabase PostgREST

    def select(
        self,
        table: str,
        *,
        select: str = "*",
        filters: Optional[Dict[str, str]] = None,
        order: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        if limit is not None:
            # Petición única con límite explícito
            params: Dict[str, str] = {"select": select}
            if filters:
                params.update(filters)
            if order:
                params["order"] = order
            params["limit"] = str(limit)
            r = self.session.get(self._url(table), params=params, timeout=self.cfg.timeout)
            r.raise_for_status()
            data = r.json()
            return data if isinstance(data, list) else [data]

        # Sin límite → paginación automática para superar max_rows=1000 de PostgREST
        all_rows: List[Dict[str, Any]] = []
        offset = 0
        while True:
            params = {
                "select": select,
                "limit": str(self._PAGE_SIZE),
                "offset": str(offset),
            }
            if filters:
                params.update(filters)
            if order:
                params["order"] = order
            r = self.session.get(self._url(table), params=params, timeout=self.cfg.timeout)
            r.raise_for_status()
            page = r.json()
            if not isinstance(page, list):
                page = [page]
            all_rows.extend(page)
            if len(page) < self._PAGE_SIZE:
                break  # última página
            offset += self._PAGE_SIZE
        return all_rows

    def insert(self, table: str, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        headers = {"Prefer": "return=representation"}
        r = self.session.post(
            self._url(table), json=rows, headers=headers, timeout=self.cfg.timeout
        )
        r.raise_for_status()
        data = r.json()
        return data if isinstance(data, list) else [data]

    def upsert(
        self,
        table: str,
        rows: List[Dict[str, Any]],
        on_conflict: str,
        ignore_duplicates: bool = False,
    ) -> List[Dict[str, Any]]:
        resolution = "ignore-duplicates" if ignore_duplicates else "merge-duplicates"
        headers = {"Prefer": f"resolution={resolution},return=representation"}
        params = {"on_conflict": on_conflict}
        r = self.session.post(
            self._url(table),
            json=rows,
            headers=headers,
            params=params,
            timeout=self.cfg.timeout,
        )
        r.raise_for_status()
        data = r.json()
        return data if isinstance(data, list) else [data]

    def patch(
        self,
        table: str,
        filters: Dict[str, str],
        patch_data: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        headers = {"Prefer": "return=representation"}
        r = self.session.patch(
            self._url(table),
            params=filters,
            json=patch_data,
            headers=headers,
            timeout=self.cfg.timeout,
        )
        r.raise_for_status()
        data = r.json()
        return data if isinstance(data, list) else [data]


def load_from_env() -> SupabaseClient:
    """Crea un SupabaseClient desde variables de entorno."""
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if not url:
        raise RuntimeError("Falta SUPABASE_URL en el entorno (.env).")
    if not key:
        raise RuntimeError("Falta SUPABASE_SERVICE_KEY en el entorno (.env).")
    return SupabaseClient(SupabaseConfig(url=url, key=key))
