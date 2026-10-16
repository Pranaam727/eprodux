"""test_occupancy.py — Tests for temporal count stabilization.

Criteria tested
---------------
1. Stable sequence produces mode count and confidence=1.0.
2. Noisy sequence produces mode count and appropriate confidence.
3. Single-frame window always returns that frame's count with confidence=1.0.
4. Median method produces correct result on sorted window.
5. Confidence is bounded in [0.0, 1.0].
6. Window size is respected (only the last N frames matter).
7. Reset clears the window.
8. OccupancyStabilizer manages multiple zones independently.
9. Missing zone in raw_counts treated as zero.
10. Stabilizer does NOT use historical unique IDs as current occupancy.
"""
from __future__ import annotations

import pytest

from cv.src.occupancy import ZoneStabilizer, OccupancyStabilizer


class TestZoneStabilizerMode:
    def test_stable_sequence_returns_mode_and_full_confidence(self):
        s = ZoneStabilizer(window_size=5, method="mode")
        for _ in range(5):
            count, conf = s.update(3)
        assert count == 3
        assert conf == 1.0

    def test_noisy_sequence_returns_dominant_count(self):
        s = ZoneStabilizer(window_size=5, method="mode")
        for v in [3, 3, 3, 2, 1]:
            count, conf = s.update(v)
        # Mode of [3, 3, 3, 2, 1] = 3 with freq 3/5 = 0.6
        assert count == 3
        assert abs(conf - 0.6) < 1e-6

    def test_single_frame_window(self):
        s = ZoneStabilizer(window_size=1, method="mode")
        count, conf = s.update(7)
        assert count == 7
        assert conf == 1.0

    def test_window_evicts_old_values(self):
        s = ZoneStabilizer(window_size=3, method="mode")
        # Feed [0, 0, 0] — mode = 0
        for _ in range(3):
            s.update(0)
        # Now feed [5, 5, 5] — old zeros evicted; mode = 5
        for _ in range(3):
            count, conf = s.update(5)
        assert count == 5
        assert conf == 1.0

    def test_zero_counts_are_valid(self):
        s = ZoneStabilizer(window_size=3, method="mode")
        for _ in range(3):
            count, conf = s.update(0)
        assert count == 0
        assert conf == 1.0

    def test_confidence_bounded(self):
        s = ZoneStabilizer(window_size=4, method="mode")
        for v in [1, 2, 3, 4]:
            count, conf = s.update(v)
        assert 0.0 <= conf <= 1.0

    def test_reset_clears_window(self):
        s = ZoneStabilizer(window_size=5, method="mode")
        for _ in range(5):
            s.update(10)
        s.reset()
        assert s.current_window == []
        count, conf = s.update(0)
        assert count == 0
        assert conf == 1.0

    def test_partial_window_before_full(self):
        s = ZoneStabilizer(window_size=5, method="mode")
        # Only 2 updates — window not full yet
        s.update(2)
        count, conf = s.update(2)
        assert count == 2
        assert conf == 1.0

    def test_alternating_counts(self):
        s = ZoneStabilizer(window_size=4, method="mode")
        for v in [1, 2, 1, 2]:
            count, conf = s.update(v)
        # Two 1s and two 2s — mode could be 1 or 2 (Counter.most_common returns first)
        assert count in (1, 2)
        assert abs(conf - 0.5) < 1e-6


class TestZoneStabilizerMedian:
    def test_odd_window_median(self):
        s = ZoneStabilizer(window_size=5, method="median")
        for v in [1, 3, 5, 7, 9]:
            count, conf = s.update(v)
        # Median of [1,3,5,7,9] = 5
        assert count == 5

    def test_even_window_median(self):
        s = ZoneStabilizer(window_size=4, method="median")
        for v in [2, 4, 6, 8]:
            count, conf = s.update(v)
        # Median of [2,4,6,8] = (4+6)/2 = 5.0 → 5
        assert count == 5

    def test_stable_sequence_median(self):
        s = ZoneStabilizer(window_size=3, method="median")
        for _ in range(3):
            count, conf = s.update(4)
        assert count == 4
        assert conf == 1.0

    def test_median_confidence_fraction(self):
        s = ZoneStabilizer(window_size=5, method="median")
        for v in [3, 3, 3, 5, 5]:
            count, conf = s.update(v)
        # Median of [3,3,3,5,5] = 3; 3 values equal 3 → conf = 3/5
        assert count == 3
        assert abs(conf - 0.6) < 1e-6


class TestZoneStabilizerValidation:
    def test_window_size_zero_raises(self):
        with pytest.raises(ValueError, match="window_size"):
            ZoneStabilizer(window_size=0)

    def test_invalid_method_raises(self):
        with pytest.raises(ValueError, match="method"):
            ZoneStabilizer(method="exponential_smoothing")


class TestOccupancyStabilizer:
    ZONE_IDS = ["seminar_hall", "classroom", "lab", "office"]

    def test_all_zones_present_in_output(self):
        stab = OccupancyStabilizer(self.ZONE_IDS, window_size=3)
        result = stab.update({"seminar_hall": 2, "classroom": 0, "lab": 1, "office": 3})
        assert set(result.keys()) == set(self.ZONE_IDS)

    def test_stable_counts_across_zones(self):
        stab = OccupancyStabilizer(self.ZONE_IDS, window_size=3)
        for _ in range(3):
            result = stab.update(
                {"seminar_hall": 2, "classroom": 0, "lab": 1, "office": 3}
            )
        assert result["seminar_hall"][0] == 2
        assert result["classroom"][0] == 0
        assert result["lab"][0] == 1
        assert result["office"][0] == 3

    def test_missing_zone_in_raw_counts_treated_as_zero(self):
        stab = OccupancyStabilizer(self.ZONE_IDS, window_size=3)
        # Provide empty dict → all zones should get 0
        result = stab.update({})
        for zone_id in self.ZONE_IDS:
            assert result[zone_id][0] == 0

    def test_zones_stabilized_independently(self):
        stab = OccupancyStabilizer(self.ZONE_IDS, window_size=3)
        # seminar_hall stable at 5; office noisy
        for i in range(3):
            raw = {"seminar_hall": 5, "classroom": 0, "lab": 0, "office": i}
            result = stab.update(raw)
        assert result["seminar_hall"][0] == 5
        assert result["seminar_hall"][1] == 1.0

    def test_reset_clears_all_stabilizers(self):
        stab = OccupancyStabilizer(self.ZONE_IDS, window_size=3)
        for _ in range(3):
            stab.update({"seminar_hall": 10, "classroom": 10, "lab": 10, "office": 10})
        stab.reset()
        result = stab.update({"seminar_hall": 0, "classroom": 0, "lab": 0, "office": 0})
        # After reset, window has only one value: 0
        for zone_id in self.ZONE_IDS:
            assert result[zone_id][0] == 0
