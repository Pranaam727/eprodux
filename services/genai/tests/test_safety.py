"""
Tests for safety rules (recommendations/safety.py).

All tests are pure Python — no external calls required.
"""

import pytest
from schemas.twin_summary import (
    EnergySource,
    LightingSource,
    OccupancySource,
    RoomSummary,
)
from recommendations.safety import (
    check_critical_equipment,
    check_emergency_lighting,
    check_lights_off,
    check_savings_data_available,
    check_unknown_occupancy,
    is_safe_to_recommend,
)


def make_room(
    room_id="classroom",
    occupancy_count=0,
    occupancy_known=True,
    lighting_on=True,
    energy_kwh=2.0,
    waste_hours=1.0,
) -> RoomSummary:
    return RoomSummary(
        room_id=room_id,
        occupancy_count=occupancy_count,
        occupancy_known=occupancy_known,
        occupancy_source=OccupancySource.SIMULATED,
        lighting_on=lighting_on,
        lighting_source=LightingSource.SIMULATED,
        energy_kwh=energy_kwh,
        energy_source=EnergySource.SIMULATED,
        waste_hours=waste_hours,
    )


class TestLightsOffRule:
    def test_blocks_when_occupied(self):
        """RULE-01: lights-off blocked when confirmed occupants > 0."""
        room = make_room(occupancy_count=5, occupancy_known=True)
        safe, reason = check_lights_off(room)
        assert not safe
        assert "RULE-01" in reason
        assert "5" in reason

    def test_allows_when_vacant_known(self):
        """RULE-01: lights-off allowed when confirmed vacant."""
        room = make_room(occupancy_count=0, occupancy_known=True)
        safe, reason = check_lights_off(room)
        assert safe
        assert reason == ""

    def test_allows_when_occupancy_not_known(self):
        """RULE-01 alone: does NOT block when occupancy unknown (RULE-02 handles that)."""
        room = make_room(occupancy_count=None, occupancy_known=False)
        safe, _ = check_lights_off(room)
        assert safe  # RULE-01 passes; RULE-02 handles unknown occupancy


class TestUnknownOccupancyRule:
    def test_blocks_when_unknown(self):
        """RULE-02: action blocked when occupancy is not known."""
        room = make_room(occupancy_known=False)
        safe, reason = check_unknown_occupancy(room, "Switch off lights")
        assert not safe
        assert "RULE-02" in reason

    def test_allows_when_known(self):
        room = make_room(occupancy_known=True)
        safe, reason = check_unknown_occupancy(room, "Switch off lights")
        assert safe
        assert reason == ""


class TestEmergencyLightingRule:
    @pytest.mark.parametrize("action", [
        "Switch off emergency lighting",
        "Turn off exit lights",
        "Disable evacuation illumination",
        "Cut fire escape lights",
    ])
    def test_blocks_emergency_keywords(self, action):
        """RULE-03: any action with emergency/life-safety keyword is blocked."""
        safe, reason = check_emergency_lighting(action)
        assert not safe
        assert "RULE-03" in reason

    def test_allows_normal_action(self):
        safe, reason = check_emergency_lighting("Switch off ceiling lights in classroom")
        assert safe
        assert reason == ""


class TestCriticalEquipmentRule:
    def test_blocks_off_in_lab(self):
        """RULE-04: 'off' action in lab room is blocked."""
        room = make_room(room_id="lab")
        safe, reason = check_critical_equipment(room, "Turn off equipment")
        assert not safe
        assert "RULE-04" in reason

    def test_blocks_fume_hood_keyword(self):
        room = make_room(room_id="classroom")
        safe, reason = check_critical_equipment(room, "Switch off fume hood")
        assert not safe
        assert "RULE-04" in reason

    def test_blocks_server_rack_keyword(self):
        room = make_room(room_id="office")
        safe, reason = check_critical_equipment(room, "Power down server rack")
        assert not safe
        assert "RULE-04" in reason

    def test_allows_normal_action_in_office(self):
        room = make_room(room_id="office")
        safe, reason = check_critical_equipment(room, "Switch off overhead lighting")
        assert safe

    def test_allows_non_off_action_in_lab(self):
        room = make_room(room_id="lab")
        safe, reason = check_critical_equipment(room, "Increase ventilation")
        assert safe


class TestSavingsDataRule:
    def test_blocks_when_no_data(self):
        """RULE-05: savings claim blocked when no meter or waste data."""
        room = make_room(energy_kwh=None, waste_hours=None)
        safe, reason = check_savings_data_available(room)
        assert not safe
        assert "RULE-05" in reason

    def test_allows_with_energy_kwh(self):
        room = make_room(energy_kwh=3.0, waste_hours=None)
        safe, _ = check_savings_data_available(room)
        assert safe

    def test_allows_with_waste_hours(self):
        room = make_room(energy_kwh=None, waste_hours=2.0)
        safe, _ = check_savings_data_available(room)
        assert safe


class TestIsSafeToRecommend:
    def test_lights_off_safe(self):
        room = make_room(occupancy_count=0, occupancy_known=True)
        safe, reason = is_safe_to_recommend(room, "lights_off", "Switch off ceiling lights")
        assert safe

    def test_lights_off_blocked_occupied(self):
        room = make_room(occupancy_count=8, occupancy_known=True)
        safe, reason = is_safe_to_recommend(room, "lights_off", "Switch off lights")
        assert not safe

    def test_lights_off_blocked_unknown_occupancy(self):
        room = make_room(occupancy_known=False, occupancy_count=None)
        safe, reason = is_safe_to_recommend(room, "lights_off", "Switch off lights")
        assert not safe

    def test_hvac_blocked_unknown_occupancy(self):
        room = make_room(occupancy_known=False)
        safe, reason = is_safe_to_recommend(room, "hvac_off", "Turn off HVAC")
        assert not safe

    def test_emergency_always_blocked(self):
        room = make_room(occupancy_count=0, occupancy_known=True)
        safe, reason = is_safe_to_recommend(room, "lights_off", "Turn off emergency exit lighting")
        assert not safe

    def test_investigate_action_always_safe(self):
        """'investigate' type bypasses occupancy checks."""
        room = make_room(occupancy_known=False)
        safe, reason = is_safe_to_recommend(room, "investigate", "Check sensor calibration")
        assert safe

    def test_other_action_safe_when_conditions_clear(self):
        room = make_room(occupancy_known=True, occupancy_count=0)
        safe, _ = is_safe_to_recommend(room, "other", "Reduce projector brightness")
        assert safe
