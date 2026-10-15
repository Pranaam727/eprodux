"""health.py — Camera / video-source health state machine.

States
------
  healthy   — frames arriving and readable normally
  degraded  — some consecutive frames missed; still reporting last known state
  failed    — too many missed frames; source considered unavailable

IMPORTANT: when health is 'failed', the pipeline MUST NOT emit a fresh
occupancy event with the last observed count, as that count is stale.
This distinction is enforced in main.py.
"""
from __future__ import annotations

import logging
from enum import Enum

logger = logging.getLogger(__name__)


class HealthState(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    FAILED = "failed"


class CameraHealth:
    """Track the health of a video source by counting consecutive bad frames."""

    def __init__(
        self,
        degraded_after: int = 3,
        failed_after: int = 10,
        log_changes: bool = True,
    ) -> None:
        if degraded_after >= failed_after:
            raise ValueError(
                "degraded_after must be less than failed_after"
            )
        self._degraded_after = degraded_after
        self._failed_after = failed_after
        self._log_changes = log_changes
        self._missed: int = 0
        self._state: HealthState = HealthState.HEALTHY

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def state(self) -> HealthState:
        return self._state

    @property
    def is_healthy(self) -> bool:
        return self._state == HealthState.HEALTHY

    @property
    def is_failed(self) -> bool:
        return self._state == HealthState.FAILED

    @property
    def consecutive_missed(self) -> int:
        return self._missed

    def record_good_frame(self) -> None:
        """Call when a frame was successfully read and processed."""
        if self._missed > 0:
            self._missed = 0
            self._transition(HealthState.HEALTHY)

    def record_bad_frame(self) -> None:
        """Call when a frame could not be read or was unreadable."""
        self._missed += 1
        if self._missed >= self._failed_after:
            self._transition(HealthState.FAILED)
        elif self._missed >= self._degraded_after:
            self._transition(HealthState.DEGRADED)

    def reset(self) -> None:
        """Reset health state (e.g. after source reconnect)."""
        self._missed = 0
        self._transition(HealthState.HEALTHY)

    def as_dict(self) -> dict:
        return {
            "state": self._state.value,
            "consecutive_missed_frames": self._missed,
        }

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _transition(self, new_state: HealthState) -> None:
        if new_state != self._state:
            if self._log_changes:
                logger.warning(
                    "[HEALTH] Camera state: %s → %s (missed=%d)",
                    self._state.value,
                    new_state.value,
                    self._missed,
                )
            self._state = new_state
