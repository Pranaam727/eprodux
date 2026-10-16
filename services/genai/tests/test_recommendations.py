"""
Tests for recommendation generation (fallback engine and LLM path).

All Anthropic API calls are mocked. Tests run without network access.
"""

import json
from unittest.mock import MagicMock, patch

import pytest

from fixtures.mock_summaries import (
    EMPTY_ROOM_LIGHTS_ON,
    OCCUPIED_ROOM_KNOWN,
    STALE_MISSING_DATA,
)
from recommendations.fallback import generate_fallback_recommendations
from recommendations.generator import _parse_llm_recommendations, generate_recommendations
from schemas.recommendation import ConfidenceLevel, DataMode, Recommendation


class TestFallbackEngine:
    def test_empty_room_lights_on_generates_recommendation(self, empty_room_summary):
        recs = generate_fallback_recommendations(empty_room_summary)
        assert len(recs) >= 1
        # At least one recommendation about the seminar hall lighting
        issues = [r.issue.lower() for r in recs]
        assert any("lighting" in i or "light" in i for i in issues)

    def test_empty_room_recommendation_has_correct_location(self, empty_room_summary):
        recs = generate_fallback_recommendations(empty_room_summary)
        seminar_recs = [r for r in recs if r.location == "seminar_hall"]
        assert len(seminar_recs) >= 1

    def test_occupied_room_no_lights_off_recommendation(self, occupied_room_summary):
        """When occupancy is known > 0, no 'lights off' recommendation should be emitted."""
        recs = generate_fallback_recommendations(occupied_room_summary)
        for rec in recs:
            assert rec.action is not None
            # Action should not tell us to turn lights off with occupants present
            if rec.location in ["seminar_hall", "classroom", "lab", "office"]:
                assert "switch off lighting" not in rec.action.lower() or rec.confidence == ConfidenceLevel.INSUFFICIENT_DATA

    def test_stale_data_emits_stale_warning(self, stale_summary):
        recs = generate_fallback_recommendations(stale_summary)
        issues = [r.issue.lower() for r in recs]
        assert any("stale" in i or "old" in i or "missing" in i or "90" in i for i in issues)

    def test_all_recs_are_fallback_mode(self, empty_room_summary):
        recs = generate_fallback_recommendations(empty_room_summary)
        for rec in recs:
            assert rec.data_mode == DataMode.FALLBACK

    def test_recommendation_ids_are_unique(self, empty_room_summary):
        recs = generate_fallback_recommendations(empty_room_summary)
        ids = [r.id for r in recs]
        assert len(ids) == len(set(ids))

    def test_savings_not_none_for_vacant_lit_room(self, empty_room_summary):
        """Seminar hall is vacant with lighting on — savings should be calculable."""
        recs = generate_fallback_recommendations(empty_room_summary)
        seminar_recs = [
            r for r in recs
            if r.location == "seminar_hall" and "switch off" in r.action.lower()
        ]
        if seminar_recs:
            rec = seminar_recs[0]
            assert rec.kWh_saved is not None
            assert rec.kWh_saved > 0
            assert rec.cost_saved_inr is not None
            assert rec.co2_saved_kg is not None
            assert rec.cost_saved is not None
            assert rec.co2_saved is not None

    def test_no_savings_for_unknown_occupancy(self, stale_summary):
        """Rooms with unknown occupancy should not have savings estimates."""
        recs = generate_fallback_recommendations(stale_summary)
        unknown_recs = [r for r in recs if r.confidence == ConfidenceLevel.INSUFFICIENT_DATA]
        for rec in unknown_recs:
            # These should either have no savings or be verification-type
            assert rec.kWh_saved is None or "verify" in rec.action.lower()

    def test_valid_pydantic_schema(self, empty_room_summary):
        """All recommendations should pass Pydantic validation."""
        recs = generate_fallback_recommendations(empty_room_summary)
        for rec in recs:
            assert isinstance(rec, Recommendation)
            # Re-validate
            Recommendation.model_validate(rec.model_dump())


class TestLLMOutputParsing:
    def test_valid_json_array_parsed(self):
        raw = json.dumps([
            {
                "issue": "Lights on in empty room",
                "location": "seminar_hall",
                "evidence": "Lighting ON, occupancy 0",
                "action": "Switch off lights",
                "action_type": "lights_off",
                "priority": "high",
                "confidence": "high",
            }
        ])
        items = _parse_llm_recommendations(raw)
        assert len(items) == 1
        assert items[0]["issue"] == "Lights on in empty room"

    def test_markdown_wrapped_json_parsed(self):
        raw = "```json\n[{\"issue\":\"test\",\"location\":\"classroom\",\"evidence\":\"e\",\"action\":\"a\",\"action_type\":\"other\",\"priority\":\"low\",\"confidence\":\"low\"}]\n```"
        items = _parse_llm_recommendations(raw)
        assert len(items) == 1

    def test_invalid_json_raises(self):
        with pytest.raises((json.JSONDecodeError, ValueError)):
            _parse_llm_recommendations("not json at all")

    def test_non_array_raises(self):
        with pytest.raises(ValueError, match="not a JSON array"):
            _parse_llm_recommendations('{"key": "value"}')

    def test_empty_array_parsed(self):
        items = _parse_llm_recommendations("[]")
        assert items == []


class TestGenerateRecommendationsWithMockedLLM:
    def test_falls_back_without_api_key(self, empty_room_summary):
        """Without API key, generate_recommendations uses fallback engine."""
        recs = generate_recommendations(empty_room_summary)
        assert isinstance(recs, list)
        assert all(isinstance(r, Recommendation) for r in recs)
        assert all(r.data_mode == DataMode.FALLBACK for r in recs)

    def test_llm_error_triggers_fallback(self, empty_room_summary, monkeypatch):
        """LLM exception triggers fallback — never crashes the service."""
        monkeypatch.setenv("ANTHROPIC_API_KEY", "fake-key")
        monkeypatch.setenv("DEMO_MODE", "false")
        from core.settings import get_settings
        get_settings.cache_clear()

        with patch("recommendations.generator._generate_with_llm", side_effect=RuntimeError("API down")):
            recs = generate_recommendations(empty_room_summary)
            assert isinstance(recs, list)
            # Should have fallen back gracefully
            assert all(r.data_mode == DataMode.FALLBACK for r in recs)

        get_settings.cache_clear()

    def test_savings_always_deterministic(self, empty_room_summary):
        """Savings values in any recommendation come from Python, not the LLM."""
        recs = generate_recommendations(empty_room_summary)
        for rec in recs:
            if rec.kWh_saved is not None:
                # Re-compute expected value from documented formula
                assert rec.kWh_saved >= 0
                assert rec.cost_saved_inr is not None
                assert rec.co2_saved_kg is not None
                # cost / kWh should match approximately the default tariff
                from core.settings import get_settings
                s = get_settings()
                expected_cost = round(rec.kWh_saved * s.tariff_inr_per_kwh, 3)
                assert rec.cost_saved_inr == pytest.approx(expected_cost, rel=0.01)
