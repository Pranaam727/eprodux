"""test_event_schema.py — Tests for CVEvent schema and serialization.

Criteria tested
---------------
1. CVEvent.create() produces a valid event.
2. UTC timestamp with 'Z' suffix is enforced.
3. Naive datetime is rejected.
4. Occupancy < 0 fails validation.
5. Invalid light_state fails validation.
6. Confidence outside [0,1] fails validation.
7. JSON round-trip preserves all fields exactly.
8. from_json / from_dict produce equivalent events.
9. is_valid() returns False for invalid events.
10. Timestamp format matches ISO 8601 with UTC Z.
"""
from __future__ import annotations

import json
import pytest
from datetime import datetime, timezone, timedelta

from cv.src.event_schema import CVEvent


FIXED_TS = datetime(2026, 10, 15, 10, 30, 0, tzinfo=timezone.utc)


class TestCVEventCreate:
    def test_create_produces_utc_timestamp(self):
        event = CVEvent.create("seminar_hall", 3, "on", 0.9, ts=FIXED_TS)
        assert event.timestamp == "2026-10-15T10:30:00Z"

    def test_create_without_ts_uses_now(self):
        event = CVEvent.create("classroom", 0, "off", 0.5)
        assert event.timestamp.endswith("Z")

    def test_create_with_naive_datetime_raises(self):
        naive = datetime(2026, 10, 15, 10, 30, 0)  # no tzinfo
        with pytest.raises(ValueError, match="Naive datetime"):
            CVEvent.create("lab", 1, "on", 0.8, ts=naive)

    def test_create_with_non_utc_timezone(self):
        # Non-UTC but aware datetimes are accepted (strftime will convert display)
        ist = timezone(timedelta(hours=5, minutes=30))
        ts = datetime(2026, 10, 15, 16, 0, 0, tzinfo=ist)
        event = CVEvent.create("office", 2, "on", 0.7, ts=ts)
        # The timestamp should still end in Z (formatted via strftime)
        assert event.timestamp.endswith("Z")

    def test_confidence_rounded_to_6_decimal_places(self):
        event = CVEvent.create("seminar_hall", 1, "on", 0.8756789123456, ts=FIXED_TS)
        # Should be rounded to 6 decimal places
        assert event.confidence == round(0.8756789123456, 6)

    def test_all_fields_set_correctly(self):
        event = CVEvent.create("lab", 5, "unknown", 0.75, ts=FIXED_TS)
        assert event.zone_id == "lab"
        assert event.occupancy == 5
        assert event.light_state == "unknown"
        assert event.confidence == 0.75


class TestCVEventValidation:
    def test_valid_event_passes(self):
        event = CVEvent.create("seminar_hall", 3, "on", 0.9, ts=FIXED_TS)
        assert event.is_valid()
        assert event.validate() == []

    def test_invalid_occupancy_negative(self):
        event = CVEvent(
            zone_id="classroom",
            timestamp="2026-10-15T10:30:00Z",
            occupancy=-1,
            light_state="on",
            confidence=0.9,
        )
        errors = event.validate()
        assert any("occupancy" in e for e in errors)
        assert not event.is_valid()

    def test_invalid_light_state(self):
        event = CVEvent(
            zone_id="lab",
            timestamp="2026-10-15T10:30:00Z",
            occupancy=0,
            light_state="bright",
            confidence=0.5,
        )
        errors = event.validate()
        assert any("light_state" in e for e in errors)

    def test_invalid_confidence_above_1(self):
        event = CVEvent(
            zone_id="office",
            timestamp="2026-10-15T10:30:00Z",
            occupancy=0,
            light_state="off",
            confidence=1.1,
        )
        errors = event.validate()
        assert any("confidence" in e for e in errors)

    def test_invalid_confidence_below_0(self):
        event = CVEvent(
            zone_id="office",
            timestamp="2026-10-15T10:30:00Z",
            occupancy=0,
            light_state="off",
            confidence=-0.1,
        )
        errors = event.validate()
        assert any("confidence" in e for e in errors)

    def test_timestamp_without_z_fails(self):
        event = CVEvent(
            zone_id="seminar_hall",
            timestamp="2026-10-15T10:30:00+05:30",
            occupancy=0,
            light_state="on",
            confidence=0.9,
        )
        errors = event.validate()
        assert any("Z" in e or "timestamp" in e for e in errors)

    def test_malformed_timestamp_fails(self):
        event = CVEvent(
            zone_id="seminar_hall",
            timestamp="not-a-date",
            occupancy=0,
            light_state="on",
            confidence=0.9,
        )
        errors = event.validate()
        assert any("timestamp" in e for e in errors)

    def test_empty_zone_id_fails(self):
        event = CVEvent(
            zone_id="",
            timestamp="2026-10-15T10:30:00Z",
            occupancy=0,
            light_state="on",
            confidence=0.9,
        )
        errors = event.validate()
        assert any("zone_id" in e for e in errors)

    def test_unknown_light_state_is_valid(self):
        """'unknown' is a valid light_state — it must never be silently changed."""
        event = CVEvent.create("office", 0, "unknown", 0.5, ts=FIXED_TS)
        assert event.is_valid()
        assert event.light_state == "unknown"

    def test_zero_occupancy_is_valid(self):
        event = CVEvent.create("seminar_hall", 0, "off", 1.0, ts=FIXED_TS)
        assert event.is_valid()

    def test_confidence_at_boundaries(self):
        for conf in [0.0, 1.0]:
            event = CVEvent.create("lab", 1, "on", conf, ts=FIXED_TS)
            assert event.is_valid(), f"confidence={conf} should be valid"


class TestCVEventSerialization:
    def test_to_dict_has_all_required_fields(self):
        event = CVEvent.create("seminar_hall", 3, "on", 0.875, ts=FIXED_TS)
        d = event.to_dict()
        assert set(d.keys()) == {"zone_id", "timestamp", "occupancy", "light_state", "confidence"}

    def test_json_round_trip(self):
        event = CVEvent.create("classroom", 2, "off", 0.6, ts=FIXED_TS)
        json_str = event.to_json()
        restored = CVEvent.from_json(json_str)
        assert restored.zone_id == event.zone_id
        assert restored.timestamp == event.timestamp
        assert restored.occupancy == event.occupancy
        assert restored.light_state == event.light_state
        assert restored.confidence == event.confidence

    def test_from_dict_round_trip(self):
        event = CVEvent.create("lab", 1, "unknown", 0.5, ts=FIXED_TS)
        restored = CVEvent.from_dict(event.to_dict())
        assert restored == event

    def test_to_json_produces_valid_json(self):
        event = CVEvent.create("office", 4, "on", 0.95, ts=FIXED_TS)
        parsed = json.loads(event.to_json())
        assert parsed["zone_id"] == "office"
        assert parsed["occupancy"] == 4

    def test_canonical_json_example(self):
        """Verify the example from the README/spec is valid."""
        example = json.dumps({
            "zone_id": "seminar_hall",
            "timestamp": "2026-10-15T10:30:00Z",
            "occupancy": 3,
            "light_state": "on",
            "confidence": 0.875,
        })
        event = CVEvent.from_json(example)
        assert event.is_valid()
        assert event.zone_id == "seminar_hall"
        assert event.occupancy == 3
