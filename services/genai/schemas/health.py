"""Health check response schema."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """GET /health response body."""
    status: str = Field(description="'ok' when the service is running correctly.")
    service: str
    version: str
    demo_mode: bool = Field(
        description="True when the service is operating on mock data.",
    )
    llm_available: bool = Field(
        description=(
            "True when the Anthropic API key is configured and reachable. "
            "False does NOT mean the service is unhealthy — fallback mode still works."
        )
    )
    twin_backend_available: bool = Field(
        description=(
            "True when the twin backend URL is reachable. "
            "False in demo mode is expected."
        )
    )
    rag_index_loaded: bool = Field(
        description="True when the RAG knowledge index has been built.",
    )
