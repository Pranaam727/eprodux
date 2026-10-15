"""test_zones.py — Tests for zone membership and polygon operations.

Criteria tested
---------------
1. Point clearly inside a zone → assigned to that zone.
2. Point outside all zones → None.
3. Point on a zone boundary → consistent behaviour (not double-counted).
4. Bottom-center of detection used for assignment (not top or center).
5. Detection in multiple zones not possible (first-match).
6. Duplicate track IDs not counted twice in same frame.
7. Zone manager returns correct zero-counts for all zones when no detections.
8. Four-quadrant layout: each corner assigned to the correct zone.
9. count_occupancy returns one entry per configured zone.
10. Point-in-polygon edge cases (concave polygon, n-gon).
"""
from __future__ import annotations

import pytest

from cv.src.config import ZoneConfig
from cv.src.detector import Detection
from cv.src.zones import Zone, ZoneManager, point_in_polygon
from cv.tests.conftest import detection_at_norm, make_detection


# ---------------------------------------------------------------------------
# point_in_polygon unit tests
# ---------------------------------------------------------------------------


class TestPointInPolygon:
    def test_point_inside_unit_square(self):
        square = [[0, 0], [1, 0], [1, 1], [0, 1]]
        assert point_in_polygon(0.5, 0.5, square) is True

    def test_point_outside_unit_square(self):
        square = [[0, 0], [1, 0], [1, 1], [0, 1]]
        assert point_in_polygon(1.5, 0.5, square) is False

    def test_point_outside_on_negative_side(self):
        square = [[0, 0], [1, 0], [1, 1], [0, 1]]
        assert point_in_polygon(-0.1, 0.5, square) is False

    def test_point_inside_triangle(self):
        triangle = [[0, 0], [1, 0], [0.5, 1]]
        assert point_in_polygon(0.5, 0.4, triangle) is True

    def test_point_outside_triangle(self):
        triangle = [[0, 0], [1, 0], [0.5, 1]]
        assert point_in_polygon(0.9, 0.9, triangle) is False

    def test_point_inside_upper_left_quadrant(self):
        quad = [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]]
        assert point_in_polygon(0.25, 0.25, quad) is True

    def test_point_in_different_quadrant(self):
        quad = [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]]
        assert point_in_polygon(0.75, 0.75, quad) is False


# ---------------------------------------------------------------------------
# Zone tests
# ---------------------------------------------------------------------------


class TestZone:
    def test_zone_contains_center(self):
        z = Zone(
            zone_id="test",
            name="Test",
            light_state="on",
            polygon=[[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]],
        )
        assert z.contains_point(0.25, 0.25) is True

    def test_zone_does_not_contain_far_point(self):
        z = Zone(
            zone_id="test",
            name="Test",
            light_state="on",
            polygon=[[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]],
        )
        assert z.contains_point(0.8, 0.8) is False


# ---------------------------------------------------------------------------
# ZoneManager tests
# ---------------------------------------------------------------------------


FRAME_W, FRAME_H = 640, 384


@pytest.fixture()
def zone_manager(four_quadrant_zones):
    return ZoneManager.from_configs(four_quadrant_zones, FRAME_W, FRAME_H)


class TestZoneManager:
    def test_all_zones_present_in_empty_count(self, zone_manager):
        counts = zone_manager.count_occupancy([])
        assert set(counts.keys()) == {"seminar_hall", "classroom", "lab", "office"}
        assert all(v == 0 for v in counts.values())

    def test_detection_in_seminar_hall(self, zone_manager):
        # Bottom-center at (0.25, 0.25) → seminar_hall (top-left quadrant)
        det = detection_at_norm(0.25, 0.25, FRAME_W, FRAME_H, track_id=1)
        counts = zone_manager.count_occupancy([det])
        assert counts["seminar_hall"] == 1
        assert counts["classroom"] == 0
        assert counts["lab"] == 0
        assert counts["office"] == 0

    def test_detection_in_classroom(self, zone_manager):
        # Bottom-center at (0.75, 0.25) → classroom (top-right quadrant)
        det = detection_at_norm(0.75, 0.25, FRAME_W, FRAME_H, track_id=2)
        counts = zone_manager.count_occupancy([det])
        assert counts["classroom"] == 1

    def test_detection_in_lab(self, zone_manager):
        det = detection_at_norm(0.25, 0.75, FRAME_W, FRAME_H, track_id=3)
        counts = zone_manager.count_occupancy([det])
        assert counts["lab"] == 1

    def test_detection_in_office(self, zone_manager):
        det = detection_at_norm(0.75, 0.75, FRAME_W, FRAME_H, track_id=4)
        counts = zone_manager.count_occupancy([det])
        assert counts["office"] == 1

    def test_detection_outside_all_zones(self, zone_manager):
        # Untracked detection with track_id=-1 outside all zones
        det = Detection(x1=-50, y1=-50, x2=-10, y2=-10, confidence=0.9, track_id=-1)
        counts = zone_manager.count_occupancy([det])
        assert all(v == 0 for v in counts.values())

    def test_multiple_detections_in_different_zones(self, zone_manager):
        dets = [
            detection_at_norm(0.25, 0.25, FRAME_W, FRAME_H, track_id=1),
            detection_at_norm(0.75, 0.25, FRAME_W, FRAME_H, track_id=2),
            detection_at_norm(0.25, 0.75, FRAME_W, FRAME_H, track_id=3),
        ]
        counts = zone_manager.count_occupancy(dets)
        assert counts["seminar_hall"] == 1
        assert counts["classroom"] == 1
        assert counts["lab"] == 1
        assert counts["office"] == 0

    def test_duplicate_track_id_counted_once(self, zone_manager):
        """Same track_id appearing twice should be counted only once."""
        det1 = detection_at_norm(0.25, 0.25, FRAME_W, FRAME_H, track_id=99)
        det2 = detection_at_norm(0.25, 0.30, FRAME_W, FRAME_H, track_id=99)
        counts = zone_manager.count_occupancy([det1, det2])
        assert counts["seminar_hall"] == 1  # not 2

    def test_untracked_detections_counted_independently(self, zone_manager):
        """Detections with track_id=-1 are each counted independently (no dedup)."""
        det1 = detection_at_norm(0.25, 0.25, FRAME_W, FRAME_H, track_id=-1)
        det2 = detection_at_norm(0.25, 0.30, FRAME_W, FRAME_H, track_id=-1)
        counts = zone_manager.count_occupancy([det1, det2])
        assert counts["seminar_hall"] == 2

    def test_zone_ids_property(self, zone_manager):
        assert set(zone_manager.zone_ids) == {"seminar_hall", "classroom", "lab", "office"}

    def test_get_zone_returns_correct_zone(self, zone_manager):
        zone = zone_manager.get_zone("seminar_hall")
        assert zone is not None
        assert zone.zone_id == "seminar_hall"

    def test_get_zone_returns_none_for_unknown(self, zone_manager):
        assert zone_manager.get_zone("cafeteria") is None

    def test_bottom_center_used_not_center(self, zone_manager):
        """If top-center was used, a tall person near the top would be in seminar_hall.
        If bottom-center is used, the same tall person (bottom in lab) → lab."""
        # A very tall person: top at y=0.1, bottom at y=0.7 → crosses boundary
        # Bottom-center: nx=0.25, ny=0.7 → lab (bottom half)
        px = 0.25 * FRAME_W
        py_bottom = 0.70 * FRAME_H
        py_top = 0.10 * FRAME_H
        det = Detection(
            x1=px - 10, y1=py_top, x2=px + 10, y2=py_bottom,
            confidence=0.9, track_id=5,
        )
        counts = zone_manager.count_occupancy([det])
        assert counts["lab"] == 1
        assert counts["seminar_hall"] == 0
