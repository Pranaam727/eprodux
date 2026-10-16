"""
Twin summary input schema.

This schema represents the data contract between the GenAI service and the
digital twin / backend service (Member 2).

ASSUMPTION: The twin backend will eventually expose a GET endpoint at
  {TWIN_BACKEND_URL}/api/twin/summary  returning JSON matching TwinSummary.

If the backend schema differs, adjust only the adapter in
  adapters/twin_adapter.py  — do NOT change this shared schema without
  coordinating with Member 2.

Field sources are explicitly typed so the GenAI service can distinguish
real sensor readings from simulated or manually supplied values.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Source/quality enumerations
# ---------------------------------------------------------------------------

class LightingSource(str, Enum):
    """How the lighting state was determined."""
    MEASURED = "measured"       # hardware sensor confirmed
    MANUAL = "manual"           # operator manually set
    SIMULATED = "simulated"     # generated for demo/testing


class EnergySource(str, Enum):
    """How energy/meter data was obtained."""
    METER = "meter"             # live smart-meter reading
    ESTIMATED = "estimated"     # calculated from device schedule
    SIMULATED = "simulated"     # generated for demo/testing


class OccupancySource(str, Enum):
    """How occupancy was determined."""
    CV = "cv"                   # computer vision (real video)
    MANUAL = "manual"           # operator-supplied count
    SIMULATED = "simulated"     # generated for demo/testing
    UNKNOWN = "unknown"         # source not determined


# ---------------------------------------------------------------------------
# Room summary
# ---------------------------------------------------------------------------

class RoomSummary(BaseModel):
    """State of a single room during the reporting period."""

    # INTEGRATION-TODO: confirm room_id values match twin/backend canonical IDs
    room_id: str = Field(
        description="Stable room identifier, e.g. 'seminar_hall'",
    )

    # Occupancy
    occupancy_count: Optional[int] = Field(
        default=None,
        ge=0,
        description="Number of people detected. None = not available.",
    )
    occupancy_known: bool = Field(
        default=False,
        description=(
            "True only when the occupancy_count is a confirmed observation, "
            "not a default or estimate."
        ),
    )
    occupancy_source: OccupancySource = Field(default=OccupancySource.UNKNOWN)

    # Lighting
    lighting_on: Optional[bool] = Field(
        default=None,
        description="Current lighting state. None = sensor unavailable.",
    )
    lighting_source: LightingSource = Field(default=LightingSource.SIMULATED)

    # Energy / metering
    energy_kwh: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Energy consumed during the period in kWh. None = no meter data.",
    )
    energy_source: EnergySource = Field(default=EnergySource.SIMULATED)

    # Derived / estimated quantities
    waste_hours: Optional[float] = Field(
        default=None,
        ge=0.0,
        description=(
            "Estimated hours lighting/HVAC ran while room was unoccupied. "
            "Calculated by twin backend — may be None if occupancy is unknown."
        ),
    )
    utilization_pct: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Room utilization as a percentage of scheduled hours.",
    )

    # Environmental sensors (optional — may be absent)
    co2_ppm: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="CO2 concentration in ppm from sensor. None = no sensor.",
    )
    temp_celsius: Optional[float] = Field(
        default=None,
        description="Air temperature in °C. None = no sensor.",
    )

    # Anomalies and warnings from the twin backend
    anomalies: List[str] = Field(
        default_factory=list,
        description="Human-readable anomaly descriptions flagged by the twin.",
    )


# ---------------------------------------------------------------------------
# Top-level twin summary
# ---------------------------------------------------------------------------

class TwinSummary(BaseModel):
    """
    Summary of building state for a reporting period.
    Produced by the digital twin / backend service and consumed by GenAI.
    """

    period_start: datetime = Field(description="Start of the reporting period (UTC).")
    period_end: datetime = Field(description="End of the reporting period (UTC).")
    rooms: List[RoomSummary] = Field(description="One entry per monitored room.")

    # Data quality
    data_freshness_minutes: Optional[float] = Field(
        default=None,
        ge=0.0,
        description=(
            "Age of the most recent data point in minutes. "
            "Values above ~60 may indicate stale data."
        ),
    )
    missing_data_warnings: List[str] = Field(
        default_factory=list,
        description="Warnings about absent or unreliable data fields.",
    )

    # Traceability
    summary_source: str = Field(
        default="unknown",
        description=(
            "'twin_backend' for live data, 'mock' for fixtures, "
            "'fallback' for rule-based generation."
        ),
    )
