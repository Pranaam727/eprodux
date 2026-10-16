"""
Application settings — loaded from environment variables.
See .env.example for all configurable options.
"""

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Service ---
    service_name: str = "eprodux-genai"
    service_version: str = "0.1.0"
    port: int = Field(default=8002, description="HTTP port for this service")
    log_level: str = Field(default="INFO", description="Logging level")

    # --- Demo / fallback mode ---
    demo_mode: bool = Field(
        default=True,
        description=(
            "When True, use mock twin data and pre-computed demo responses. "
            "Set to False only when real integrations are available."
        ),
    )

    # --- Claude / Anthropic ---
    anthropic_api_key: Optional[str] = Field(
        default=None,
        description="Anthropic API key — leave unset to use fallback engine",
    )
    claude_model: str = Field(
        default="claude-3-5-haiku-20241022",
        description="Claude model identifier",
    )
    llm_timeout_seconds: float = Field(default=15.0)
    llm_max_retries: int = Field(default=2, ge=0, le=5)

    # --- Twin backend integration ---
    twin_backend_url: str = Field(
        default="http://localhost:8001",
        description=(
            "Base URL of the digital twin / backend service. "
            "INTEGRATION-TODO: confirm URL with twin/backend member."
        ),
    )
    twin_summary_path: str = Field(
        default="/api/twin/summary",
        description=(
            "Path appended to twin_backend_url to fetch the current summary. "
            "INTEGRATION-TODO: confirm path with twin/backend member."
        ),
    )
    twin_timeout_seconds: float = Field(default=5.0)

    # --- Savings calculation constants ---
    # Source: India CEA average grid emissions intensity (2022-23 report).
    # INTEGRATION-TODO: update if project uses state-specific or measured values.
    emissions_factor_kg_per_kwh: float = Field(
        default=0.82,
        description="kg CO2 per kWh — India CEA average, illustrative",
    )
    tariff_inr_per_kwh: float = Field(
        default=8.0,
        description="Electricity tariff in INR/kWh — illustrative default",
    )

    # --- RAG ---
    knowledge_dir: str = Field(
        default="rag/knowledge",
        description="Directory containing sustainability guidance documents",
    )
    rag_index_path: str = Field(
        default="rag/.index_cache",
        description="Path to the persisted RAG index",
    )
    rag_top_k: int = Field(default=3, ge=1, le=10)

    @property
    def llm_available(self) -> bool:
        """True only if an API key is configured."""
        return bool(self.anthropic_api_key)

    @property
    def twin_summary_url(self) -> str:
        return f"{self.twin_backend_url.rstrip('/')}{self.twin_summary_path}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
