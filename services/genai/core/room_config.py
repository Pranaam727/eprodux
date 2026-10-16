"""
Room configuration — single source of truth for room IDs and device power assumptions.

INTEGRATION-TODO: Confirm canonical room IDs and device power values with the
twin/backend member before final integration. IDs are currently provisional.

All power values are in kilowatts (kW).
"""

from enum import Enum
from typing import Dict


# ---------------------------------------------------------------------------
# Room identifiers
# INTEGRATION-TODO: confirm these IDs match the twin/backend schema
# ---------------------------------------------------------------------------
class RoomID(str, Enum):
    SEMINAR_HALL = "seminar_hall"
    CLASSROOM = "classroom"
    LAB = "lab"
    OFFICE = "office"


# ---------------------------------------------------------------------------
# Device power assumptions (kW)
# Source: illustrative estimates — not derived from live meter readings.
# INTEGRATION-TODO: replace with values agreed with the hardware/twin team.
# ---------------------------------------------------------------------------
ROOM_DEVICE_POWER_KW: Dict[RoomID, Dict[str, float]] = {
    RoomID.SEMINAR_HALL: {
        "lighting": 2.0,   # ~20 × 100 W fixtures
        "hvac": 5.0,        # central split, large space
        "av_equipment": 0.8,
    },
    RoomID.CLASSROOM: {
        "lighting": 1.2,   # ~15 × 80 W fixtures
        "hvac": 3.0,
        "projector": 0.3,
    },
    RoomID.LAB: {
        "lighting": 1.5,
        "hvac": 4.0,
        "equipment": 3.0,  # generic lab equipment estimate
    },
    RoomID.OFFICE: {
        "lighting": 0.8,
        "hvac": 2.0,
        "workstations": 1.0,
    },
}

# Room display names for human-readable output
ROOM_DISPLAY_NAMES: Dict[RoomID, str] = {
    RoomID.SEMINAR_HALL: "Seminar Hall",
    RoomID.CLASSROOM: "Classroom",
    RoomID.LAB: "Laboratory",
    RoomID.OFFICE: "Office",
}

# Rooms where critical equipment must never be shut down
CRITICAL_EQUIPMENT_ROOMS: frozenset = frozenset({RoomID.LAB})

# Default operating hours per day (used when actual schedule is unknown)
DEFAULT_DAILY_OPERATING_HOURS: float = 8.0
