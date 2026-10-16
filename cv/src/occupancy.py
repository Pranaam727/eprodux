"""occupancy.py — Temporal count stabilization.

Reduces count flickering by applying a sliding-window aggregation
over recent per-zone detection counts.

Methods
-------
  mode   — most frequently occurring count in the window (default)
  median — median value (rounded to nearest int)

Confidence
----------
  Defined as the fraction of frames in the window that agreed on the
  stabilized count. This is a COUNT-STABILITY SCORE, not a calibrated
  probability of the true occupancy. A value of 1.0 means every frame
  in the window reported the same count.
"""
from __future__ import annotations

import logging
import math
from collections import deque, Counter

logger = logging.getLogger(__name__)


class ZoneStabilizer:
    """Sliding-window count stabilizer for one zone."""

    def __init__(self, window_size: int = 5, method: str = "mode") -> None:
        if window_size < 1:
            raise ValueError("window_size must be >= 1")
        if method not in ("mode", "median"):
            raise ValueError("method must be 'mode' or 'median'")
        self._window: deque[int] = deque(maxlen=window_size)
        self._method = method

    def update(self, raw_count: int) -> tuple[int, float]:
        """Add a new raw count. Returns (stabilized_count, confidence).

        confidence — fraction of window frames that agreed on the output count.
        """
        self._window.append(raw_count)

        if self._method == "mode":
            return self._mode_result()
        else:
            return self._median_result()

    def _mode_result(self) -> tuple[int, float]:
        counter = Counter(self._window)
        mode_count, mode_freq = counter.most_common(1)[0]
        confidence = mode_freq / len(self._window)
        return mode_count, confidence

    def _median_result(self) -> tuple[int, float]:
        sorted_vals = sorted(self._window)
        n = len(sorted_vals)
        if n % 2 == 1:
            median_val = sorted_vals[n // 2]
        else:
            median_val = (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2.0
        stabilized = int(round(median_val))
        # Confidence: fraction of values equal to the stabilized count
        agreement = sum(1 for v in self._window if v == stabilized)
        confidence = agreement / n
        return stabilized, confidence

    @property
    def window_size(self) -> int:
        return self._window.maxlen  # type: ignore[return-value]

    @property
    def current_window(self) -> list[int]:
        return list(self._window)

    def reset(self) -> None:
        self._window.clear()


class OccupancyStabilizer:
    """Manage one ZoneStabilizer per zone."""

    def __init__(
        self,
        zone_ids: list[str],
        window_size: int = 5,
        method: str = "mode",
    ) -> None:
        self._stabilizers: dict[str, ZoneStabilizer] = {
            zid: ZoneStabilizer(window_size=window_size, method=method)
            for zid in zone_ids
        }

    def update(
        self, raw_counts: dict[str, int]
    ) -> dict[str, tuple[int, float]]:
        """Update all zones with new raw counts.

        Returns dict mapping zone_id → (stabilized_count, confidence).
        """
        results: dict[str, tuple[int, float]] = {}
        for zone_id, stabilizer in self._stabilizers.items():
            raw = raw_counts.get(zone_id, 0)
            results[zone_id] = stabilizer.update(raw)
        return results

    def reset(self) -> None:
        for s in self._stabilizers.values():
            s.reset()
