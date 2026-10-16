from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator

CANONICAL_ROOM_IDS = ("seminar_hall", "classroom", "lab", "office")
RoomId = Literal["seminar_hall", "classroom", "lab", "office"]


def ensure_timezone_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class OccupancyEvent(BaseModel):
    """
    CV Occupancy Event Contract.
    Note: Lighting is intentionally decoupled and must not be represented as a CV detection.
    """
    event_id: str = Field(..., description="Unique event identifier for deduplication")
    zone_id: RoomId = Field(..., description="Canonical room identifier")
    timestamp: datetime = Field(..., description="ISO 8601 timestamp with timezone")
    occupancy: int = Field(..., ge=0, description="Detected occupant headcount")
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Inference confidence")
    source: Literal["recorded-video", "webcam", "rtsp", "mock"] = Field(
        ..., description="Data source origin"
    )

    @field_validator("timestamp", mode="after")
    @classmethod
    def validate_tz(cls, v: datetime) -> datetime:
        return ensure_timezone_aware(v)


class LightingInput(BaseModel):
    """
    Lighting state input supplied manually or simulated.
    Never reported as CV-detected lighting.
    """
    room_id: RoomId = Field(..., description="Canonical room identifier")
    timestamp: datetime = Field(..., description="ISO 8601 timestamp with timezone")
    light_state: Literal["on", "off", "unknown"] = Field(..., description="Lighting operational state")
    source: Literal["manual", "simulated", "unknown"] = Field(..., description="Source of update")

    @field_validator("timestamp", mode="after")
    @classmethod
    def validate_tz(cls, v: datetime) -> datetime:
        return ensure_timezone_aware(v)


class CameraHealthInput(BaseModel):
    """Camera heartbeat or explicit status report."""
    room_id: RoomId = Field(..., description="Canonical room identifier")
    timestamp: datetime = Field(..., description="ISO 8601 timestamp with timezone")
    status: Literal["online", "offline"] = Field(..., description="Camera operational status")
    source: str = Field(..., description="Telemetry source component")

    @field_validator("timestamp", mode="after")
    @classmethod
    def validate_tz(cls, v: datetime) -> datetime:
        return ensure_timezone_aware(v)


class AnomalyAlert(BaseModel):
    rule_id: str
    severity: Literal["info", "warning", "critical"]
    message: str
    raised_at: datetime
    evidence: Dict[str, Any]

    @field_validator("raised_at", mode="after")
    @classmethod
    def validate_tz(cls, v: datetime) -> datetime:
        return ensure_timezone_aware(v)


class EnvironmentalReadings(BaseModel):
    temperature_c: Optional[float] = None
    relative_humidity_pct: Optional[float] = None
    co2_ppm: Optional[float] = None
    provenance: Literal["simulated", "sensor", "unknown"] = "simulated"


class EnergyReadings(BaseModel):
    estimated_current_power_w: Optional[float] = None
    provenance: Literal["simulated", "metered", "calculated"] = "simulated"
    calculation_basis: Optional[str] = None


class RoomProvenance(BaseModel):
    occupancy: str
    lighting: str
    camera_health: str
    environment: str
    energy: str


class RoomState(BaseModel):
    room_id: RoomId
    name: str
    occupancy: Optional[int] = None
    occupancy_status: Literal["known", "unknown"]
    confidence: Optional[float] = None
    light_state: Literal["on", "off", "unknown"]
    light_source: Optional[str] = None
    camera_status: Literal["online", "offline", "stale", "unknown"]
    last_event_at: Optional[datetime] = None
    vacancy_seconds: Optional[float] = None
    environmental_data: Optional[EnvironmentalReadings] = None
    energy_data: Optional[EnergyReadings] = None
    provenance: RoomProvenance
    anomalies: List[AnomalyAlert] = Field(default_factory=list)

    @field_validator("last_event_at", mode="after")
    @classmethod
    def validate_tz(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None:
            return ensure_timezone_aware(v)
        return v


class BuildingStateSnapshot(BaseModel):
    building_id: str
    floor_id: str
    updated_at: datetime
    run_mode: Literal["mock", "live", "replay"]
    rooms: List[RoomState]

    @field_validator("updated_at", mode="after")
    @classmethod
    def validate_tz(cls, v: datetime) -> datetime:
        return ensure_timezone_aware(v)


class RoomSummaryMetric(BaseModel):
    room_id: RoomId
    name: str
    observed_seconds: float
    waste_hours: float
    estimated_waste_kwh: float
    utilization_rate: Optional[float] = None
    anomalies_detected: List[Dict[str, Any]] = Field(default_factory=list)


class DailySummaryMetrics(BaseModel):
    total_waste_hours: float
    total_estimated_waste_kwh: float
    rooms: List[RoomSummaryMetric]


class ObservationWindow(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_seconds: float
    coverage_ratio_24h: float


class DailySummary(BaseModel):
    period: Literal["day"] = "day"
    generated_at: datetime
    provenance: Dict[str, Any]
    observation_window: ObservationWindow
    completeness_status: Literal["complete", "incomplete", "insufficient_data"]
    data_quality_notes: List[str]
    metrics: DailySummaryMetrics

    @field_validator("generated_at", mode="after")
    @classmethod
    def validate_tz(cls, v: datetime) -> datetime:
        return ensure_timezone_aware(v)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    run_mode: str
    storage: str
