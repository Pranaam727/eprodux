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
from dataclasses import dataclass

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


@dataclass
class ZoneOccupancyMetric:
    """Distinct occupancy measurements per zone."""
    zone_id: str
    current_occupancy: int        # Estimated distinct people currently in room (with occlusion grace period)
    detection_count: int          # Raw person bounding box detections in this frame
    unique_tracked_people: int    # Cumulative distinct tracking IDs seen in this room
    confidence: float             # Count stability score in [0.0, 1.0] across sliding window
    active_track_ids: list[int]   # Track IDs currently active in zone


class ActiveTrackTracker:
    """Manages active person tracks and distinct occupancy concepts per room zone.

    Occupancy Concepts:
    - detection_count: raw person bounding boxes in the current frame.
    - current_occupancy: distinct people currently active in the room (with occlusion grace period).
    - unique_tracked_people: cumulative distinct tracking IDs seen in this room across the session.

    Occlusion & Track Expiry:
    If a person is temporarily occluded (e.g. by furniture or another person), ByteTrack might
    drop detection for 1-2 frames. The track remains active until `track_expiry_sec` has elapsed
    without observing that track ID.
    """

    def __init__(
        self,
        zone_ids: list[str],
        window_size: int = 5,
        method: str = "mode",
        track_expiry_sec: float = 2.0,
    ) -> None:
        self.zone_ids = list(zone_ids)
        self.track_expiry_sec = track_expiry_sec
        self._stabilizers = {zid: ZoneStabilizer(window_size=window_size, method=method) for zid in zone_ids}
        self._active_tracks: dict[str, dict[int, float]] = {zid: {} for zid in zone_ids}
        self._unique_tracks: dict[str, set[int]] = {zid: set() for zid in zone_ids}

    def update_frame(
        self,
        detections_by_zone: dict[str, list[tuple[int, float]]],
        timestamp_sec: float,
    ) -> dict[str, ZoneOccupancyMetric]:
        """Update active tracks and return distinct occupancy metrics per zone."""
        metrics: dict[str, ZoneOccupancyMetric] = {}

        for zone_id in self.zone_ids:
            zone_dets = detections_by_zone.get(zone_id, [])
            raw_detection_count = len(zone_dets)

            active = self._active_tracks[zone_id]
            unique = self._unique_tracks[zone_id]
            untracked_count = 0

            for tid, _ in zone_dets:
                if tid != -1:
                    active[tid] = timestamp_sec
                    unique.add(tid)
                else:
                    untracked_count += 1

            # Evict tracks that have exceeded track_expiry_sec without being observed
            expired_ids = [
                tid for tid, last_seen in active.items()
                if (timestamp_sec - last_seen) > self.track_expiry_sec
            ]
            for tid in expired_ids:
                del active[tid]

            # Raw current occupancy: active tracks + untracked instantaneous detections
            raw_current_occupancy = len(active) + untracked_count

            # Apply temporal stabilization to smooth brief spikes
            stabilizer = self._stabilizers[zone_id]
            stabilized_occ, stability_score = stabilizer.update(raw_current_occupancy)

            metrics[zone_id] = ZoneOccupancyMetric(
                zone_id=zone_id,
                current_occupancy=stabilized_occ,
                detection_count=raw_detection_count,
                unique_tracked_people=len(unique),
                confidence=round(stability_score, 4),
                active_track_ids=sorted(list(active.keys())),
            )

        return metrics

    def reset(self) -> None:
        for s in self._stabilizers.values():
            s.reset()
        for zid in self.zone_ids:
            self._active_tracks[zid].clear()
            self._unique_tracks[zid].clear()
