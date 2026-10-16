"""
FastAPI application entry point for the Eprodux GenAI service.

Pipeline position: Sense → See (CV) → Twin (Backend) → Think (GenAI) → Act (Dashboard)
Service port:      8002 (default; override via PORT env var)
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routes import chat, health, recommendations
from core.logging_config import configure_logging
from core.settings import get_settings
from rag.ingestion import ingest_documents, load_index, save_index
from rag.retrieval import set_index

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan: startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Build or load the RAG index on startup."""
    settings = get_settings()
    configure_logging(settings.log_level, settings.service_name)

    logger.info(
        "Eprodux GenAI service starting — demo_mode=%s, llm_available=%s",
        settings.demo_mode,
        settings.llm_available,
    )

    # Try loading cached index first; rebuild if missing or stale
    index = load_index(settings.rag_index_path)
    if index is None or not index.chunks:
        logger.info("Building RAG index from %s …", settings.knowledge_dir)
        index = ingest_documents(settings.knowledge_dir)
        if index.chunks:
            try:
                save_index(index, settings.rag_index_path)
            except Exception as e:
                logger.warning("Could not save RAG index: %s", e)

    set_index(index)
    logger.info("RAG index ready: %d chunks.", len(index.chunks))

    yield  # app runs here

    logger.info("Eprodux GenAI service shutting down.")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Eprodux GenAI Service",
        description=(
            "Generative AI service for the Eprodux university building digital twin. "
            "Produces grounded energy-efficiency recommendations and chat responses "
            "from twin summaries, with RAG-retrieved sustainability guidelines."
        ),
        version=settings.service_version,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS — allow all origins in dev/demo; restrict in production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routes
    app.include_router(health.router)
    app.include_router(recommendations.router)
    app.include_router(chat.router)

    # ---------------------------------------------------------------------------
    # Exception handlers
    # ---------------------------------------------------------------------------

    @app.exception_handler(404)
    async def not_found(_: Request, exc: Exception):
        return JSONResponse(status_code=404, content={"detail": "Endpoint not found."})

    @app.exception_handler(422)
    async def validation_error(_: Request, exc: Exception):
        return JSONResponse(
            status_code=422,
            content={"detail": "Request validation failed.", "errors": str(exc)},
        )

    @app.exception_handler(500)
    async def internal_error(_: Request, exc: Exception):
        logger.error("Unhandled error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error. Check service logs."},
        )

    return app


app = create_app()

# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    configure_logging(settings.log_level)
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=True)
