"""
Eprodux Digital Twin & Backend Foundation — Main Application.
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup logging/initialization
    yield
    # Shutdown cleanup


app = FastAPI(
    title="Eprodux Digital Twin & Backend API",
    version=settings.version,
    description=(
        "Digital Twin service for the Eprodux university building floor monitoring project.\n\n"
        "### Architectural Boundaries:\n"
        "- **Member 1 (CV)**: Ingests occupancy headcounts to `/api/events/cv`.\n"
        "- **Member 2 (Twin/Backend - This Service)**: Canonical building model, state snapshots, "
        "lighting state inputs, camera health, idle-lit anomaly detection, WebSocket live updates, "
        "and daily summary.\n"
        "- **Member 3 (GenAI/RAG)**: Exclusively owns recommendation generation and `/api/recommendations`.\n"
        "- **Member 4 (Frontend)**: React dashboard and floor plan visualization."
    ),
    lifespan=lifespan,
)

# Enable CORS for Member 4's React frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", tags=["Root"])
def root_info():
    return {
        "service": settings.app_name,
        "version": settings.version,
        "docs_url": "/docs",
        "health_url": "/healthz",
        "state_url": "/api/state",
        "ws_url": "/ws/state",
        "summary_url": "/api/summary?period=day",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        reload=False,
    )
