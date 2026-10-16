"""
End-to-end scenario tests using all three mock twin summaries.

Each scenario runs through the full fallback pipeline and verifies that
output is correct, safe, and schema-valid.
"""

import pytest

from fixtures.mock_summaries import ALL_SCENARIOS
from recommendations.fallback import generate_fallback_recommendations
from schemas.recommendation import ConfidenceLevel, DataMode, Recommendation


class TestScenario1EmptyRoomLightsOn:
    """Vacant seminar hall with lighting left on."""

    def test_generates_at_least_one_recommendation(self, empty_room_summary):
        recs = generate_fallback_recommendations(empty_room_summary)
        assert len(recs) >= 1

    def test_high_priority_for_wasted_lighting(self, empty_room_summary):
        recs = generate_fallback_recommendations(empty_room_summary)
        high_recs = [r for r in recs if r.priority.value == "high"]
        assert len(high_recs) >= 1, "Expected at least one HIGH priority recommendation."

    def test_location_is_seminar_hall(self, empty_room_summary):
        recs = generate_fallback_recommendations(empty_room_summary)
        locations = {r.location for r in recs}
        assert "seminar_hall" in locations

    def test_kWh_saved_positive(self, empty_room_summary):
        recs = generate_fallback_recommendations(empty_room_summary)
        seminar_recs = [r for r in recs if r.location == "seminar_hall" and r.kWh_saved is not None]
        if seminar_recs:
            assert seminar_recs[0].kWh_saved > 0

    def test_all_data_mode_fallback(self, empty_room_summary):
        recs = generate_fallback_recommendations(empty_room_summary)
        assert all(r.data_mode == DataMode.FALLBACK for r in recs)

    def test_no_lights_off_when_occupied_room(self, empty_room_summary):
        """Other rooms (classroom/lab/office) are vacant & lights off — no issues there."""
        recs = generate_fallback_recommendations(empty_room_summary)
        for rec in recs:
            if rec.location != "seminar_hall":
                # These rooms have lights OFF — no lights-off recommendation needed
                assert "switch off lighting" not in rec.action.lower() or rec.location == "seminar_hall"

    def test_schema_valid(self, empty_room_summary):
        recs = generate_fallback_recommendations(empty_room_summary)
        for rec in recs:
            Recommendation.model_validate(rec.model_dump())


class TestScenario2OccupiedRoomKnown:
    """Classroom with 12 confirmed occupants and elevated CO2."""

    def test_generates_recommendations(self, occupied_room_summary):
        recs = generate_fallback_recommendations(occupied_room_summary)
        assert isinstance(recs, list)

    def test_no_lights_off_recommendation_for_occupied_rooms(self, occupied_room_summary):
        """Safety rule: no 'switch off lighting' when confirmed occupants."""
        recs = generate_fallback_recommendations(occupied_room_summary)
        for rec in recs:
            if rec.location in ("classroom", "seminar_hall", "lab", "office"):
                # If lights off action, confidence must indicate insufficient data
                if "switch off lighting" in rec.action.lower():
                    assert rec.confidence == ConfidenceLevel.INSUFFICIENT_DATA, (
                        f"Lights-off recommendation should not be actionable in occupied room: {rec.location}"
                    )

    def test_co2_anomaly_mentioned(self, occupied_room_summary):
        """Classroom CO2 > 1000 ppm should generate a recommendation."""
        recs = generate_fallback_recommendations(occupied_room_summary)
        co2_recs = [
            r for r in recs
            if "co2" in r.issue.lower() or "co₂" in r.issue.lower() or "1050" in r.evidence
        ]
        assert len(co2_recs) >= 1, "Expected a CO2 ventilation recommendation."

    def test_schema_valid(self, occupied_room_summary):
        recs = generate_fallback_recommendations(occupied_room_summary)
        for rec in recs:
            Recommendation.model_validate(rec.model_dump())


class TestScenario3StaleMissingData:
    """Stale data (90 min old), missing meter reading, unknown occupancy."""

    def test_stale_data_warning_generated(self, stale_summary):
        recs = generate_fallback_recommendations(stale_summary)
        stale_recs = [r for r in recs if "stale" in r.issue.lower() or "90" in r.evidence]
        assert len(stale_recs) >= 1

    def test_unknown_occupancy_no_actionable_lights_off(self, stale_summary):
        """With unknown occupancy, lights-off should require verification, not be actionable."""
        recs = generate_fallback_recommendations(stale_summary)
        for rec in recs:
            if rec.location in ("seminar_hall", "office") and "switch off" in rec.action.lower():
                # Action must be verification-oriented
                assert (
                    "verify" in rec.action.lower()
                    or rec.confidence == ConfidenceLevel.INSUFFICIENT_DATA
                ), f"Unexpected actionable lights-off with unknown occupancy: {rec}"

    def test_no_savings_claim_with_missing_meter(self, stale_summary):
        """Lab has no energy meter — no kWh savings should be claimed for it."""
        recs = generate_fallback_recommendations(stale_summary)
        lab_recs = [r for r in recs if r.location == "lab" and r.kWh_saved is not None]
        # Lab has no energy_kwh and no waste_hours — savings should be None
        assert len(lab_recs) == 0, "Should not claim kWh savings for lab with no meter data."

    def test_missing_data_warnings_in_output(self, stale_summary):
        recs = generate_fallback_recommendations(stale_summary)
        # Missing-data warnings from the summary should surface as recommendations
        warning_recs = [r for r in recs if "missing" in r.issue.lower() or "warning" in r.issue.lower()]
        assert len(warning_recs) >= 1

    def test_schema_valid(self, stale_summary):
        recs = generate_fallback_recommendations(stale_summary)
        for rec in recs:
            Recommendation.model_validate(rec.model_dump())


class TestAllScenarios:
    @pytest.mark.parametrize("scenario_name", list(ALL_SCENARIOS.keys()))
    def test_scenario_runs_without_error(self, scenario_name):
        summary = ALL_SCENARIOS[scenario_name]
        recs = generate_fallback_recommendations(summary)
        assert isinstance(recs, list)

    @pytest.mark.parametrize("scenario_name", list(ALL_SCENARIOS.keys()))
    def test_scenario_produces_valid_schema(self, scenario_name):
        summary = ALL_SCENARIOS[scenario_name]
        recs = generate_fallback_recommendations(summary)
        for rec in recs:
            Recommendation.model_validate(rec.model_dump())

    @pytest.mark.parametrize("scenario_name", list(ALL_SCENARIOS.keys()))
    def test_scenario_all_recs_have_ids(self, scenario_name):
        summary = ALL_SCENARIOS[scenario_name]
        recs = generate_fallback_recommendations(summary)
        for rec in recs:
            assert rec.id, f"Recommendation missing id in scenario {scenario_name}"
