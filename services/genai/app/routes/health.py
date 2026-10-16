"""
GET /health

Returns service health and dependency status.
Does NOT expose API keys or secrets.
"""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter

from core.settings import get_settings
from rag.retrieval import get_index
from schemas.health import HealthResponse

router = APIRouter()
logger = logging.getLogger(__name__)


async def _check_twin_backend(url: str, timeout: float) -> bool:
    """Lightweight reachability check — HEAD or GET /health on twin backend."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(f"{url.rstrip('/')}/health")
            return r.status_code < 500
    except Exception:
        return False


async def _check_llm(api_key: str | None, model: str, timeout: float) -> bool:
    """Verify the Anthropic API is reachable with a minimal API call."""
    if not api_key:
        return False
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        # List models is the lightest available endpoint
        client.models.list()
        return True
    except Exception:
        return False


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health() -> HealthResponse:
    """
    Service health and dependency status.

    - `llm_available` reflects whether the LLM API key is configured AND
      reachable. False does NOT mean the service is unhealthy — the fallback
      engine still works.
    - `twin_backend_available` reflects reachability of the twin service.
    - Secrets (API keys, URLs) are never included in the response.
    """
    settings = get_settings()

    llm_ok = await _check_llm(settings.anthropic_api_key, settings.claude_model, settings.llm_timeout_seconds)
    twin_ok = await _check_twin_backend(settings.twin_backend_url, settings.twin_timeout_seconds)
    rag_ok = get_index() is not None and len((get_index() or type('_', (), {'chunks': []})()).chunks) > 0

    return HealthResponse(
        status="ok",
        service=settings.service_name,
        version=settings.service_version,
        demo_mode=settings.demo_mode,
        llm_available=llm_ok,
        twin_backend_available=twin_ok,
        rag_index_loaded=rag_ok,
    )
