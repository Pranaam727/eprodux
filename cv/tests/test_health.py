"""test_health.py — Tests for CameraHealth state machine.

Criteria tested
---------------
1. Initial state is healthy.
2. Consecutive bad frames → degraded after threshold.
3. More bad frames → failed after threshold.
4. Good frame resets to healthy from degraded.
5. Good frame resets to healthy from failed.
6. degraded_after >= failed_after is rejected.
7. Health is_failed and is_healthy properties work correctly.
8. as_dict returns correct structure.
9. State does not flip back prematurely.
10. CRITICAL: failed state must prevent fresh zero-occupancy events in pipeline.
"""
from __future__ import annotations

import pytest

from cv.src.health import CameraHealth, HealthState


class TestCameraHealth:
    def test_initial_state_is_healthy(self):
        h = CameraHealth(degraded_after=3, failed_after=10)
        assert h.state == HealthState.HEALTHY
        assert h.is_healthy is True
        assert h.is_failed is False

    def test_bad_frames_cause_degraded(self):
        h = CameraHealth(degraded_after=3, failed_after=10)
        for _ in range(3):
            h.record_bad_frame()
        assert h.state == HealthState.DEGRADED

    def test_bad_frames_cause_failed(self):
        h = CameraHealth(degraded_after=3, failed_after=10)
        for _ in range(10):
            h.record_bad_frame()
        assert h.state == HealthState.FAILED
        assert h.is_failed is True

    def test_not_degraded_before_threshold(self):
        h = CameraHealth(degraded_after=3, failed_after=10)
        for _ in range(2):
            h.record_bad_frame()
        assert h.state == HealthState.HEALTHY

    def test_good_frame_resets_from_degraded(self):
        h = CameraHealth(degraded_after=3, failed_after=10)
        for _ in range(3):
            h.record_bad_frame()
        assert h.state == HealthState.DEGRADED
        h.record_good_frame()
        assert h.state == HealthState.HEALTHY
        assert h.consecutive_missed == 0

    def test_good_frame_resets_from_failed(self):
        h = CameraHealth(degraded_after=3, failed_after=10)
        for _ in range(10):
            h.record_bad_frame()
        h.record_good_frame()
        assert h.state == HealthState.HEALTHY

    def test_good_frame_when_already_healthy_is_no_op(self):
        h = CameraHealth(degraded_after=3, failed_after=10)
        h.record_good_frame()  # Already healthy
        assert h.state == HealthState.HEALTHY
        assert h.consecutive_missed == 0

    def test_reset_method(self):
        h = CameraHealth(degraded_after=3, failed_after=10)
        for _ in range(10):
            h.record_bad_frame()
        assert h.is_failed
        h.reset()
        assert h.state == HealthState.HEALTHY
        assert h.consecutive_missed == 0

    def test_degraded_after_ge_failed_after_raises(self):
        with pytest.raises(ValueError, match="degraded_after"):
            CameraHealth(degraded_after=10, failed_after=10)

    def test_degraded_after_gt_failed_after_raises(self):
        with pytest.raises(ValueError, match="degraded_after"):
            CameraHealth(degraded_after=15, failed_after=10)

    def test_consecutive_missed_count(self):
        h = CameraHealth(degraded_after=3, failed_after=10)
        for i in range(5):
            h.record_bad_frame()
        assert h.consecutive_missed == 5

    def test_missed_count_resets_on_good_frame(self):
        h = CameraHealth(degraded_after=3, failed_after=10)
        for _ in range(5):
            h.record_bad_frame()
        h.record_good_frame()
        assert h.consecutive_missed == 0

    def test_as_dict_structure(self):
        h = CameraHealth(degraded_after=3, failed_after=10)
        d = h.as_dict()
        assert "state" in d
        assert "consecutive_missed_frames" in d
        assert d["state"] == "healthy"

    def test_as_dict_after_failure(self):
        h = CameraHealth(degraded_after=3, failed_after=5)
        for _ in range(5):
            h.record_bad_frame()
        d = h.as_dict()
        assert d["state"] == "failed"
        assert d["consecutive_missed_frames"] == 5

    def test_single_bad_frame_does_not_suppress_events(self):
        """One bad frame should not yet be failed — events still flow."""
        h = CameraHealth(degraded_after=3, failed_after=10)
        h.record_bad_frame()
        assert not h.is_failed
        # This test represents the invariant: pipeline only suppresses events
        # when h.is_failed is True.

    def test_failed_state_invariant(self):
        """CRITICAL: when is_failed, pipeline must NOT emit stale zero-occupancy."""
        h = CameraHealth(degraded_after=2, failed_after=5)
        for _ in range(5):
            h.record_bad_frame()
        assert h.is_failed
        # The pipeline checks h.is_failed before emitting events.
        # This test validates the health flag that the pipeline depends on.
        # The pipeline's actual suppression logic is tested in test_pipeline.py.

    def test_state_transitions_are_monotone_on_bad_frames(self):
        """State never goes backwards on consecutive bad frames."""
        h = CameraHealth(degraded_after=3, failed_after=6)
        states = []
        for _ in range(8):
            h.record_bad_frame()
            states.append(h.state)
        # Should go: healthy(x2) → degraded(x3) → failed(x3)
        assert HealthState.HEALTHY not in states[3:]  # Never returns to healthy
