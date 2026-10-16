"""
Deterministic fallback recommendation engine.

This module generates recommendations using explicit if/else rules applied
to the twin summary. It does NOT call the LLM and operates fully offline.

It is used when:
- GENAI_DEMO_MODE=true
- The LLM API key is absent or the API is unavailable
- LLM call exhausts retries

Output is clearly labelled with data_mode=DataMode.FALLBACK.
Savings are computed by the deterministic savings module.
All safety rules are applied before any recommendation is emitted.
"""

from __future__ import annotations

import logging
import uuid
from typing import List

from core.room_config import ROOM_DEVICE_POWER_KW, ROOM_DISPLAY_NAMES, RoomID
from recommendations.safety import is_safe_to_recommend
from recommendations.savings import SavingsResult, calculate_savings
from schemas.recommendation import (
    ConfidenceLevel,
    DataMode,
    Priority,
    Recommendation,
)
from schemas.twin_summary import RoomSummary, TwinSummary

logger = logging.getLogger(__name__)

# Default avoidable hours assumption when waste_hours is missing
_DEFAULT_WASTE_HOURS = 2.0
# Fraction of waste hours assumed to be avoidable through automation
_SAVINGS_FRACTION = 0.8


def _make_id() -> str:
    return str(uuid.uuid4())[:8]


def _room_label(room_id: str) -> str:
    try:
        return ROOM_DISPLAY_NAMES[RoomID(room_id)]
    except (ValueError, KeyError):
        return room_id


def _get_power(room_id: str, device: str) -> float:
    """Return device power in kW from config, or a conservative default."""
    try:
        return ROOM_DEVICE_POWER_KW[RoomID(room_id)].get(device, 1.0)
    except (ValueError, KeyError):
        return 1.0


def _savings_for_lighting(room: RoomSummary) -> SavingsResult:
    power = _get_power(room.room_id, "lighting")
    hours = room.waste_hours if room.waste_hours is not None else _DEFAULT_WASTE_HOURS
    return calculate_savings(power_kw=power, avoidable_hours=hours, savings_fraction=_SAVINGS_FRACTION)


def _savings_for_hvac(room: RoomSummary) -> SavingsResult:
    power = _get_power(room.room_id, "hvac")
    hours = room.waste_hours if room.waste_hours is not None else _DEFAULT_WASTE_HOURS
    return calculate_savings(power_kw=power, avoidable_hours=hours, savings_fraction=_SAVINGS_FRACTION)


def _confidence(room: RoomSummary) -> ConfidenceLevel:
    if room.occupancy_known and room.energy_kwh is not None:
        return ConfidenceLevel.HIGH
    if room.occupancy_known or room.energy_kwh is not None:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW


def _generate_for_room(room: RoomSummary) -> List[Recommendation]:
    recs: List[Recommendation] = []
    label = _room_label(room.room_id)

    # ── Rule A: Lights on, room vacant ──────────────────────────────────────
    if (
        room.lighting_on is True
        and room.occupancy_known
        and room.occupancy_count == 0
    ):
        safe, reason = is_safe_to_recommend(room, "lights_off", "Switch off lighting")
        if safe:
            s = _savings_for_lighting(room)
            recs.append(Recommendation(
                id=_make_id(),
                issue=f"Lighting left on in unoccupied {label}",
                location=room.room_id,
                evidence=(
                    f"Lighting is ON (source: {room.lighting_source.value}). "
                    f"Occupancy: 0 confirmed (source: {room.occupancy_source.value}). "
                    + (f"Waste hours: {room.waste_hours} h." if room.waste_hours else "Waste hours estimated.")
                ),
                action=f"Switch off lighting in {label} immediately.",
                priority=Priority.HIGH,
                kWh_saved=s.kwh_saved,
                cost_saved_inr=s.cost_saved_inr,
                co2_saved_kg=s.co2_saved_kg,
                confidence=_confidence(room),
                data_mode=DataMode.FALLBACK,
                savings_assumptions=s.assumptions_text,
            ))
        else:
            # Emit a verification-needed recommendation instead
            recs.append(Recommendation(
                id=_make_id(),
                issue=f"Lighting state uncertain in {label}",
                location=room.room_id,
                evidence=reason,
                action="Verify room vacancy before switching off lighting.",
                priority=Priority.MEDIUM,
                confidence=ConfidenceLevel.INSUFFICIENT_DATA,
                data_mode=DataMode.FALLBACK,
            ))

    # ── Rule B: Lights on, occupancy unknown ────────────────────────────────
    elif room.lighting_on is True and not room.occupancy_known:
        recs.append(Recommendation(
            id=_make_id(),
            issue=f"Lighting on with unknown occupancy in {label}",
            location=room.room_id,
            evidence=(
                f"Lighting is ON (source: {room.lighting_source.value}). "
                "Occupancy status is unknown — cannot verify safe switch-off."
            ),
            action=f"Verify occupancy in {label} before switching off lighting.",
            priority=Priority.MEDIUM,
            kWh_saved=None,
            cost_saved_inr=None,
            co2_saved_kg=None,
            confidence=ConfidenceLevel.INSUFFICIENT_DATA,
            data_mode=DataMode.FALLBACK,
            savings_assumptions="Savings cannot be estimated without occupancy confirmation.",
        ))

    # ── Rule C: Stale data warning ───────────────────────────────────────────
    if room.anomalies:
        for anomaly in room.anomalies:
            recs.append(Recommendation(
                id=_make_id(),
                issue=f"Anomaly detected in {label}",
                location=room.room_id,
                evidence=anomaly,
                action="Investigate anomaly and update sensor readings.",
                priority=Priority.LOW,
                confidence=ConfidenceLevel.LOW,
                data_mode=DataMode.FALLBACK,
            ))

    # ── Rule D: High CO2 with known occupancy ───────────────────────────────
    if room.co2_ppm is not None and room.co2_ppm > 1000 and room.occupancy_known:
        recs.append(Recommendation(
            id=_make_id(),
            issue=f"Elevated CO2 in {label} ({room.co2_ppm:.0f} ppm)",
            location=room.room_id,
            evidence=f"CO2 measured at {room.co2_ppm:.0f} ppm (threshold: 1000 ppm).",
            action="Increase ventilation or open windows in {label}.".format(label=label),
            priority=Priority.MEDIUM,
            confidence=ConfidenceLevel.HIGH if room.occupancy_known else ConfidenceLevel.MEDIUM,
            data_mode=DataMode.FALLBACK,
        ))

    # ── Rule E: No issues detected ──────────────────────────────────────────
    if not recs and room.occupancy_known:
        logger.debug("No issues detected for room %s in fallback engine.", room.room_id)

    return recs


def generate_fallback_recommendations(summary: TwinSummary) -> List[Recommendation]:
    """
    Generate deterministic recommendations from twin summary using rule engine.
    No LLM call is made. All output is labelled DataMode.FALLBACK.
    """
    all_recs: List[Recommendation] = []
    for room in summary.rooms:
        room_recs = _generate_for_room(room)
        all_recs.extend(room_recs)

    # Global: stale data across the whole summary
    if summary.data_freshness_minutes is not None and summary.data_freshness_minutes > 60:
        all_recs.append(Recommendation(
            id=_make_id(),
            issue="Stale twin data — observations older than 60 minutes",
            location="building",
            evidence=f"Twin data is {summary.data_freshness_minutes:.0f} minutes old.",
            action="Refresh twin data before acting on recommendations.",
            priority=Priority.HIGH,
            confidence=ConfidenceLevel.INSUFFICIENT_DATA,
            data_mode=DataMode.FALLBACK,
        ))

    for warning in summary.missing_data_warnings:
        all_recs.append(Recommendation(
            id=_make_id(),
            issue="Missing data warning",
            location="building",
            evidence=warning,
            action="Restore sensor or data feed before estimating savings.",
            priority=Priority.LOW,
            confidence=ConfidenceLevel.INSUFFICIENT_DATA,
            data_mode=DataMode.FALLBACK,
        ))

    logger.info("Fallback engine generated %d recommendation(s).", len(all_recs))
    return all_recs
