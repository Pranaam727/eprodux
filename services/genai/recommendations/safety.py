"""
Safety rules for recommendations.

Every proposed recommendation must pass these checks before being returned
to the caller. Rules are explicit and deterministic — no LLM involvement.

Rule catalogue (with rationale):
    RULE-01  No lights-off when occupancy is known > 0.
             Rationale: turning off lights on present occupants is unsafe.
    RULE-02  No HVAC/lighting action when occupancy is unknown (occupancy_known=False)
             and the action type is safety-critical.
             Rationale: we cannot verify the space is empty.
    RULE-03  No emergency lighting shutoff (keyword detection).
             Rationale: emergency lighting is a life-safety system.
    RULE-04  No critical lab/server equipment shutoff.
             Rationale: equipment may be required for safety or live experiments.
    RULE-05  No savings claim when energy_kwh is None AND waste_hours is None.
             Rationale: cannot quantify savings without any meter or waste data.
    RULE-06  No action on unknown occupancy for high-priority interventions.
             Rationale: prefer verification over potentially dangerous automation.
"""

from __future__ import annotations

from typing import Tuple

from core.room_config import CRITICAL_EQUIPMENT_ROOMS, RoomID
from schemas.twin_summary import RoomSummary

# Keywords that indicate emergency/life-safety systems.
# Detection is keyword-based — not a perfect classifier.
EMERGENCY_KEYWORDS = frozenset(
    {"emergency", "exit", "egress", "evacuation", "fire", "escape"}
)

# Keywords indicating critical equipment categories.
CRITICAL_KEYWORDS = frozenset(
    {
        "fume hood", "fume cupboard", "biosafety cabinet", "bsc",
        "server rack", "ups", "environmental chamber", "incubator",
        "centrifuge", "autoclave",
    }
)


def _contains_keyword(text: str, keywords: frozenset) -> bool:
    """Case-insensitive keyword check."""
    t = text.lower()
    return any(kw in t for kw in keywords)


def check_lights_off(room: RoomSummary) -> Tuple[bool, str]:
    """
    RULE-01: Block 'turn lights off' when occupancy is confirmed > 0.
    Returns (is_safe: bool, reason: str).
    """
    if room.occupancy_known and room.occupancy_count is not None and room.occupancy_count > 0:
        return False, (
            f"RULE-01: Lighting cannot be switched off in {room.room_id} — "
            f"{room.occupancy_count} occupant(s) are confirmed present."
        )
    return True, ""


def check_unknown_occupancy(room: RoomSummary, action_description: str) -> Tuple[bool, str]:
    """
    RULE-02/06: Block safety-affecting actions when occupancy is unknown.
    """
    if not room.occupancy_known:
        return False, (
            f"RULE-02: Occupancy in {room.room_id} is unknown. "
            f"Action '{action_description}' requires confirmed vacancy before execution."
        )
    return True, ""


def check_emergency_lighting(action_description: str) -> Tuple[bool, str]:
    """
    RULE-03: Block any action that mentions emergency lighting systems.
    """
    if _contains_keyword(action_description, EMERGENCY_KEYWORDS):
        return False, (
            "RULE-03: Action involves emergency/life-safety keywords and cannot be automated. "
            "Manual review required."
        )
    return True, ""


def check_critical_equipment(room: RoomSummary, action_description: str) -> Tuple[bool, str]:
    """
    RULE-04: Block equipment-off actions in critical rooms or when action mentions critical equipment.
    """
    try:
        room_id_enum = RoomID(room.room_id)
        if room_id_enum in CRITICAL_EQUIPMENT_ROOMS and "off" in action_description.lower():
            return False, (
                f"RULE-04: {room.room_id} contains critical equipment. "
                "Any power-off action must be co-ordinated with the laboratory manager."
            )
    except ValueError:
        pass  # Unknown room ID — allow, do not block unconditionally.

    if _contains_keyword(action_description, CRITICAL_KEYWORDS):
        return False, (
            "RULE-04: Action involves critical laboratory or server equipment. "
            "Manual review by lab manager required before execution."
        )
    return True, ""


def check_savings_data_available(room: RoomSummary) -> Tuple[bool, str]:
    """
    RULE-05: Block savings claim when there is no meter or waste-hour data.
    """
    if room.energy_kwh is None and room.waste_hours is None:
        return False, (
            f"RULE-05: No energy meter data or waste-hours available for {room.room_id}. "
            "Savings cannot be estimated — data collection recommended."
        )
    return True, ""


def is_safe_to_recommend(
    room: RoomSummary,
    action_type: str,
    action_description: str,
) -> Tuple[bool, str]:
    """
    Run all applicable safety checks for a proposed recommendation.

    Parameters
    ----------
    room             : RoomSummary from the twin.
    action_type      : One of 'lights_off', 'hvac_off', 'setback', 'investigate', 'other'.
    action_description : Free-text description of the action (from LLM or fallback).

    Returns
    -------
    (True, "") if safe to proceed.
    (False, reason_string) if any rule blocks the recommendation.
    """
    checks = []

    # Always run emergency lighting check
    checks.append(check_emergency_lighting(action_description))

    # Always run critical equipment check
    checks.append(check_critical_equipment(room, action_description))

    if action_type == "lights_off":
        checks.append(check_lights_off(room))
        # If occupancy is unknown, require verification instead
        if not room.occupancy_known:
            checks.append(check_unknown_occupancy(room, action_description))

    elif action_type in ("hvac_off", "setback"):
        # HVAC actions need confirmed occupancy status
        if not room.occupancy_known:
            checks.append(check_unknown_occupancy(room, action_description))

    for safe, reason in checks:
        if not safe:
            return False, reason

    return True, ""
