"""
Deterministic Mock Scenario Provider for Eprodux Digital Twin.
Initializes the four canonical rooms according to the agreed scenario requirements:
1. Seminar Hall: 0 occupants, lights ON, sustained vacancy (>= 300s) -> triggers idle-lit alert.
2. Classroom: people present (14), lights ON -> normal occupancy, no anomaly.
3. Lab: camera offline -> occupancy is UNKNOWN.
4. Office: 1 occupant, simulated environmental readings (CO2, temp, humidity).
"""
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.config import settings
from app.models.schemas import (
    CANONICAL_ROOM_IDS,
    EnergyReadings,
    EnvironmentalReadings,
    RoomProvenance,
    RoomState,
)


def load_building_config() -> Dict[str, Any]:
    config_path = settings.resolve_building_config_path()
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    # Fallback default definition if file not found at runtime
    return {
        "building_id": "eprodux_bldg_01",
        "name": "Academic Science & Engineering Complex",
        "floors": [
            {
                "floor_id": "floor_01",
                "name": "First Floor",
                "level": 1,
                "rooms": [
                    {"room_id": "seminar_hall", "name": "Seminar Hall", "area_sqm": 180.0},
                    {"room_id": "classroom", "name": "Classroom 101", "area_sqm": 85.0},
                    {"room_id": "lab", "name": "Robotics & IoT Lab", "area_sqm": 110.0},
                    {"room_id": "office", "name": "Faculty Office Suite", "area_sqm": 45.0},
                ],
            }
        ],
    }


def get_default_room_metadata(room_id: str, building_json: Dict[str, Any]) -> Dict[str, Any]:
    floors = building_json.get("floors", [])
    for floor in floors:
        for r in floor.get("rooms", []):
            if r.get("room_id") == room_id:
                return r
    return {"room_id": room_id, "name": room_id.replace("_", " ").title()}


def get_lighting_rated_power(room_id: str, building_json: Dict[str, Any]) -> Optional[float]:
    room_meta = get_default_room_metadata(room_id, building_json)
    for dev in room_meta.get("devices", []):
        if dev.get("type") == "lighting_group":
            return dev.get("rated_power_w")
    return None


def generate_initial_room_states(
    now: Optional[datetime] = None,
    building_json: Optional[Dict[str, Any]] = None,
) -> Dict[str, RoomState]:
    if now is None:
        now = datetime.now(timezone.utc)
    if building_json is None:
        building_json = load_building_config()

    states: Dict[str, RoomState] = {}

    # 1. Seminar Hall: 0 occupants, lights ON, vacancy 300s -> idle-lit condition
    sh_rated_power = get_lighting_rated_power("seminar_hall", building_json)
    states["seminar_hall"] = RoomState(
        room_id="seminar_hall",
        name="Seminar Hall",
        occupancy=0,
        occupancy_status="known",
        confidence=0.95,
        light_state="on",
        light_source="manual",
        camera_status="online",
        last_event_at=now - timedelta(seconds=10),
        vacancy_seconds=300.0,
        environmental_data=EnvironmentalReadings(
            temperature_c=21.5,
            relative_humidity_pct=46.0,
            co2_ppm=430.0,
            provenance="simulated",
        ),
        energy_data=EnergyReadings(
            estimated_current_power_w=sh_rated_power or 1200.0,
            provenance="simulated",
            calculation_basis="rated_lighting_power",
        ),
        provenance=RoomProvenance(
            occupancy="recorded-video",
            lighting="manual",
            camera_health="heartbeat",
            environment="simulated",
            energy="simulated",
        ),
        anomalies=[],  # Will be populated by TwinService evaluating anomaly rules
    )

    # 2. Classroom: 14 occupants, lights ON, no anomaly
    cr_rated_power = get_lighting_rated_power("classroom", building_json)
    states["classroom"] = RoomState(
        room_id="classroom",
        name="Classroom 101",
        occupancy=14,
        occupancy_status="known",
        confidence=0.92,
        light_state="on",
        light_source="manual",
        camera_status="online",
        last_event_at=now - timedelta(seconds=12),
        vacancy_seconds=None,
        environmental_data=EnvironmentalReadings(
            temperature_c=22.8,
            relative_humidity_pct=52.0,
            co2_ppm=780.0,
            provenance="simulated",
        ),
        energy_data=EnergyReadings(
            estimated_current_power_w=cr_rated_power or 600.0,
            provenance="simulated",
            calculation_basis="rated_lighting_power",
        ),
        provenance=RoomProvenance(
            occupancy="recorded-video",
            lighting="manual",
            camera_health="heartbeat",
            environment="simulated",
            energy="simulated",
        ),
        anomalies=[],
    )

    # 3. Lab: camera offline -> occupancy is UNKNOWN
    lab_rated_power = get_lighting_rated_power("lab", building_json)
    states["lab"] = RoomState(
        room_id="lab",
        name="Robotics & IoT Lab",
        occupancy=None,
        occupancy_status="unknown",
        confidence=None,
        light_state="off",
        light_source="manual",
        camera_status="offline",
        last_event_at=now - timedelta(minutes=15),
        vacancy_seconds=None,
        environmental_data=EnvironmentalReadings(
            temperature_c=20.9,
            relative_humidity_pct=42.0,
            co2_ppm=410.0,
            provenance="simulated",
        ),
        energy_data=EnergyReadings(
            estimated_current_power_w=0.0,
            provenance="simulated",
            calculation_basis="lights_off",
        ),
        provenance=RoomProvenance(
            occupancy="recorded-video",
            lighting="manual",
            camera_health="heartbeat",
            environment="simulated",
            energy="simulated",
        ),
        anomalies=[],
    )

    # 4. Office: 1 occupant, simulated environmental data
    off_rated_power = get_lighting_rated_power("office", building_json)
    states["office"] = RoomState(
        room_id="office",
        name="Faculty Office Suite",
        occupancy=1,
        occupancy_status="known",
        confidence=0.88,
        light_state="on",
        light_source="manual",
        camera_status="online",
        last_event_at=now - timedelta(seconds=8),
        vacancy_seconds=None,
        environmental_data=EnvironmentalReadings(
            temperature_c=22.1,
            relative_humidity_pct=44.0,
            co2_ppm=520.0,
            provenance="simulated",
        ),
        energy_data=EnergyReadings(
            estimated_current_power_w=off_rated_power or 300.0,
            provenance="simulated",
            calculation_basis="rated_lighting_power",
        ),
        provenance=RoomProvenance(
            occupancy="recorded-video",
            lighting="manual",
            camera_health="heartbeat",
            environment="simulated",
            energy="simulated",
        ),
        anomalies=[],
    )

    return states
