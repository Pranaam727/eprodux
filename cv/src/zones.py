"""zones.py — Normalized-polygon room zone membership.

Zones are defined in normalized [0,1] coordinates.
Person assignment uses the bottom-center of the bounding box.

A person is never counted in more than one zone (first-match policy
with a logged warning if zones overlap).

Privacy: only coordinates are processed; no image data is stored.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from cv.src.config import ZoneConfig
from cv.src.detector import Detection

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Point-in-polygon (ray-casting algorithm)
# ---------------------------------------------------------------------------


def point_in_polygon(x: float, y: float, polygon: list[list[float]]) -> bool:
    """Return True if (x, y) is inside the given polygon.

    Uses the ray-casting algorithm. Works for convex and concave polygons.
    Points exactly on an edge may return True or False (boundary ambiguity
    is acceptable for occupancy counting purposes).
    """
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside


# ---------------------------------------------------------------------------
# Zone
# ---------------------------------------------------------------------------


@dataclass
class Zone:
    """One room zone with a normalized polygon."""

    zone_id: str
    name: str
    light_state: str
    polygon: list[list[float]]  # [[x,y], ...] normalized [0,1]

    def contains_point(self, x_norm: float, y_norm: float) -> bool:
        """Return True if the normalized point (x_norm, y_norm) is in this zone."""
        return point_in_polygon(x_norm, y_norm, self.polygon)


# ---------------------------------------------------------------------------
# Zone manager
# ---------------------------------------------------------------------------


class ZoneManager:
    """Manage all room zones and assign detections to zones.

    Usage
    -----
    zm = ZoneManager.from_configs(zone_configs, frame_width=640, frame_height=384)
    counts = zm.count_occupancy(detections)
    # counts == {"seminar_hall": 2, "classroom": 0, ...}
    """

    def __init__(
        self,
        zones: list[Zone],
        frame_width: int,
        frame_height: int,
    ) -> None:
        self._zones = zones
        self._frame_width = frame_width
        self._frame_height = frame_height

    @classmethod
    def from_configs(
        cls,
        zone_configs: list[ZoneConfig],
        frame_width: int,
        frame_height: int,
    ) -> "ZoneManager":
        zones = [
            Zone(
                zone_id=zc.id,
                name=zc.name,
                light_state=zc.light_state,
                polygon=zc.polygon,
            )
            for zc in zone_configs
        ]
        manager = cls(zones, frame_width, frame_height)
        manager._warn_on_overlap()
        return manager

    # ------------------------------------------------------------------
    # Core assignment
    # ------------------------------------------------------------------

    def assign_detection(self, det: Detection) -> str | None:
        """Return the zone_id for a detection, or None if outside all zones.

        Uses the bottom-center of the bounding box in normalized coordinates.
        First-match policy: if zones overlap, the person is assigned to the
        first zone in the configuration list.
        """
        bx, by = det.bottom_center
        # Normalize to [0,1]
        nx = bx / self._frame_width
        ny = by / self._frame_height

        for zone in self._zones:
            if zone.contains_point(nx, ny):
                return zone.zone_id
        return None

    def count_occupancy(self, detections: list[Detection]) -> dict[str, int]:
        """Count detections per zone.

        Returns a dict mapping every configured zone_id to its count.
        People outside all zones are not counted. A detection is never
        counted in more than one zone.
        """
        counts: dict[str, int] = {z.zone_id: 0 for z in self._zones}
        seen_track_ids: set[int] = set()

        for det in detections:
            # Avoid double-counting the same tracked person
            if det.track_id != -1:
                if det.track_id in seen_track_ids:
                    continue
                seen_track_ids.add(det.track_id)

            zone_id = self.assign_detection(det)
            if zone_id is not None:
                counts[zone_id] += 1

        return counts

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def zones(self) -> list[Zone]:
        return list(self._zones)

    @property
    def zone_ids(self) -> list[str]:
        return [z.zone_id for z in self._zones]

    def get_zone(self, zone_id: str) -> Zone | None:
        for z in self._zones:
            if z.zone_id == zone_id:
                return z
        return None

    # ------------------------------------------------------------------
    # Validation helpers
    # ------------------------------------------------------------------

    def _warn_on_overlap(self) -> None:
        """Log warnings if zone centers fall inside other zones (heuristic check)."""
        for i, za in enumerate(self._zones):
            for j, zb in enumerate(self._zones):
                if i >= j:
                    continue
                # Check if any vertex of za is inside zb
                for pt in za.polygon:
                    if zb.contains_point(pt[0], pt[1]):
                        logger.warning(
                            "[Zones] Possible overlap: zone %r vertex %s falls inside zone %r. "
                            "Calibrate polygons to avoid double-counting.",
                            za.zone_id,
                            pt,
                            zb.zone_id,
                        )
                        break
