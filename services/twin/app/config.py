import os
from pathlib import Path
from pydantic import BaseModel, Field

class Settings(BaseModel):
    app_name: str = "eprodux-twin"
    version: str = "0.1.0"
    host: str = Field(default_factory=lambda: os.getenv("TWIN_HOST", "0.0.0.0"))
    port: int = Field(default_factory=lambda: int(os.getenv("TWIN_PORT", "8000")))
    log_level: str = Field(default_factory=lambda: os.getenv("TWIN_LOG_LEVEL", "INFO"))
    run_mode: str = Field(default_factory=lambda: os.getenv("TWIN_RUN_MODE", "mock"))
    
    stale_threshold_seconds: float = Field(
        default_factory=lambda: float(os.getenv("TWIN_STALE_THRESHOLD_SECONDS", "30.0"))
    )
    idle_lit_threshold_seconds: float = Field(
        default_factory=lambda: float(os.getenv("TWIN_IDLE_LIT_THRESHOLD_SECONDS", "120.0"))
    )
    min_confidence_threshold: float = Field(
        default_factory=lambda: float(os.getenv("TWIN_MIN_CONFIDENCE_THRESHOLD", "0.70"))
    )

    building_config_path: str = Field(
        default_factory=lambda: os.getenv("TWIN_BUILDING_CONFIG_PATH", "contracts/building.json")
    )

    def resolve_building_config_path(self) -> Path:
        p = Path(self.building_config_path)
        if p.is_absolute() and p.exists():
            return p
        # Check current working directory
        if p.exists():
            return p.resolve()
        # Check relative to git repository root if possible
        cur = Path(__file__).resolve().parent
        for _ in range(5):
            candidate = cur / self.building_config_path
            if candidate.exists():
                return candidate.resolve()
            if (cur / ".git").exists() or (cur / "contracts").exists():
                break
            cur = cur.parent
        return p.resolve()

settings = Settings()
