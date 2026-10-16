"""
Mock twin summaries for testing and demo mode.

Three deterministic scenarios:
  1. EMPTY_ROOM_LIGHTS_ON   — vacant seminar hall, lighting left on
  2. OCCUPIED_ROOM_KNOWN    — classroom with 12 confirmed occupants
  3. STALE_MISSING_DATA     — lab with old data and no meter reading

All fixtures are clearly labelled summary_source="mock".
Occupancy values from CV are marked as SIMULATED (not real video).
"""

from __future__ import annotations

from datetime import datetime, timezone

from schemas.twin_summary import (
    EnergySource,
    LightingSource,
    OccupancySource,
    RoomSummary,
    TwinSummary,
)

# ---------------------------------------------------------------------------
# Scenario 1: Empty room — lights left on
# ---------------------------------------------------------------------------
EMPTY_ROOM_LIGHTS_ON = TwinSummary(
    period_start=datetime(2024, 10, 15, 8, 0, 0, tzinfo=timezone.utc),
    period_end=datetime(2024, 10, 15, 10, 0, 0, tzinfo=timezone.utc),
    data_freshness_minutes=5.0,
    missing_data_warnings=[],
    summary_source="mock",
    rooms=[
        RoomSummary(
            room_id="seminar_hall",
            occupancy_count=0,
            occupancy_known=True,
            occupancy_source=OccupancySource.SIMULATED,
            lighting_on=True,
            lighting_source=LightingSource.SIMULATED,
            energy_kwh=4.0,
            energy_source=EnergySource.SIMULATED,
            waste_hours=2.0,
            utilization_pct=0.0,
            co2_ppm=420.0,
            temp_celsius=26.5,
            anomalies=["Lighting active with zero occupancy for 2+ hours."],
        ),
        RoomSummary(
            room_id="classroom",
            occupancy_count=0,
            occupancy_known=True,
            occupancy_source=OccupancySource.SIMULATED,
            lighting_on=False,
            lighting_source=LightingSource.SIMULATED,
            energy_kwh=0.5,
            energy_source=EnergySource.SIMULATED,
            waste_hours=0.0,
            utilization_pct=0.0,
            co2_ppm=415.0,
            temp_celsius=25.0,
        ),
        RoomSummary(
            room_id="lab",
            occupancy_count=0,
            occupancy_known=True,
            occupancy_source=OccupancySource.SIMULATED,
            lighting_on=False,
            lighting_source=LightingSource.SIMULATED,
            energy_kwh=2.5,
            energy_source=EnergySource.SIMULATED,
            waste_hours=0.0,
            utilization_pct=10.0,
        ),
        RoomSummary(
            room_id="office",
            occupancy_count=0,
            occupancy_known=True,
            occupancy_source=OccupancySource.SIMULATED,
            lighting_on=False,
            lighting_source=LightingSource.SIMULATED,
            energy_kwh=0.2,
            energy_source=EnergySource.SIMULATED,
            waste_hours=0.0,
            utilization_pct=0.0,
        ),
    ],
)

# ---------------------------------------------------------------------------
# Scenario 2: Room with known occupants — all sensors active
# ---------------------------------------------------------------------------
OCCUPIED_ROOM_KNOWN = TwinSummary(
    period_start=datetime(2024, 10, 15, 10, 0, 0, tzinfo=timezone.utc),
    period_end=datetime(2024, 10, 15, 12, 0, 0, tzinfo=timezone.utc),
    data_freshness_minutes=2.0,
    missing_data_warnings=[],
    summary_source="mock",
    rooms=[
        RoomSummary(
            room_id="seminar_hall",
            occupancy_count=45,
            occupancy_known=True,
            occupancy_source=OccupancySource.SIMULATED,
            lighting_on=True,
            lighting_source=LightingSource.SIMULATED,
            energy_kwh=10.0,
            energy_source=EnergySource.SIMULATED,
            waste_hours=0.0,
            utilization_pct=90.0,
            co2_ppm=780.0,
            temp_celsius=27.0,
        ),
        RoomSummary(
            room_id="classroom",
            occupancy_count=12,
            occupancy_known=True,
            occupancy_source=OccupancySource.SIMULATED,
            lighting_on=True,
            lighting_source=LightingSource.SIMULATED,
            energy_kwh=3.6,
            energy_source=EnergySource.SIMULATED,
            waste_hours=0.0,
            utilization_pct=80.0,
            co2_ppm=1050.0,   # slightly elevated — ventilation recommendation
            temp_celsius=28.0,
            anomalies=["CO2 above 1000 ppm threshold."],
        ),
        RoomSummary(
            room_id="lab",
            occupancy_count=3,
            occupancy_known=True,
            occupancy_source=OccupancySource.SIMULATED,
            lighting_on=True,
            lighting_source=LightingSource.SIMULATED,
            energy_kwh=8.0,
            energy_source=EnergySource.SIMULATED,
            waste_hours=0.0,
            utilization_pct=60.0,
            co2_ppm=500.0,
            temp_celsius=22.0,
        ),
        RoomSummary(
            room_id="office",
            occupancy_count=5,
            occupancy_known=True,
            occupancy_source=OccupancySource.SIMULATED,
            lighting_on=True,
            lighting_source=LightingSource.SIMULATED,
            energy_kwh=2.4,
            energy_source=EnergySource.SIMULATED,
            waste_hours=0.0,
            utilization_pct=100.0,
            co2_ppm=460.0,
            temp_celsius=24.0,
        ),
    ],
)

# ---------------------------------------------------------------------------
# Scenario 3: Stale / missing data
# ---------------------------------------------------------------------------
STALE_MISSING_DATA = TwinSummary(
    period_start=datetime(2024, 10, 15, 6, 0, 0, tzinfo=timezone.utc),
    period_end=datetime(2024, 10, 15, 8, 0, 0, tzinfo=timezone.utc),
    data_freshness_minutes=90.0,  # stale
    missing_data_warnings=[
        "Lab energy meter offline — no kWh reading available.",
        "Office occupancy sensor not responding.",
    ],
    summary_source="mock",
    rooms=[
        RoomSummary(
            room_id="seminar_hall",
            occupancy_count=None,
            occupancy_known=False,
            occupancy_source=OccupancySource.UNKNOWN,
            lighting_on=True,
            lighting_source=LightingSource.SIMULATED,
            energy_kwh=6.0,
            energy_source=EnergySource.SIMULATED,
            waste_hours=None,
            anomalies=["Occupancy data unavailable — cannot confirm vacancy."],
        ),
        RoomSummary(
            room_id="classroom",
            occupancy_count=0,
            occupancy_known=True,
            occupancy_source=OccupancySource.SIMULATED,
            lighting_on=False,
            lighting_source=LightingSource.SIMULATED,
            energy_kwh=1.0,
            energy_source=EnergySource.SIMULATED,
            waste_hours=0.5,
        ),
        RoomSummary(
            room_id="lab",
            occupancy_count=None,
            occupancy_known=False,
            occupancy_source=OccupancySource.UNKNOWN,
            lighting_on=None,   # sensor offline
            lighting_source=LightingSource.SIMULATED,
            energy_kwh=None,    # meter offline
            energy_source=EnergySource.SIMULATED,
            waste_hours=None,
            anomalies=["Energy meter offline.", "Occupancy sensor offline."],
        ),
        RoomSummary(
            room_id="office",
            occupancy_count=None,
            occupancy_known=False,
            occupancy_source=OccupancySource.UNKNOWN,
            lighting_on=True,
            lighting_source=LightingSource.SIMULATED,
            energy_kwh=1.8,
            energy_source=EnergySource.SIMULATED,
            waste_hours=None,
            anomalies=["Occupancy sensor not responding."],
        ),
    ],
)

# Catalogue for easy iteration in tests
ALL_SCENARIOS = {
    "empty_room_lights_on": EMPTY_ROOM_LIGHTS_ON,
    "occupied_room_known": OCCUPIED_ROOM_KNOWN,
    "stale_missing_data": STALE_MISSING_DATA,
}
