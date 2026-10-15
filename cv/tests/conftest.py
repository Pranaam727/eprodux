"""conftest.py — Shared fixtures for CV tests.

All tests run WITHOUT downloading YOLO model weights or accessing a camera.
Model-dependent code is mocked here.
"""
from __future__ import annotations

import pytest

from cv.src.config import ZoneConfig, CVConfig, VideoSourceConfig, ModelConfig
from cv.src.config import TrackerConfig, StabilizationConfig, PublisherConfig, HealthConfig, LoggingConfig
from cv.src.detector import Detection


# ---------------------------------------------------------------------------
# Zone fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def four_quadrant_zones() -> list[ZoneConfig]:
    """Four non-overlapping quadrant zones covering the full [0,1]x[0,1] space."""
    return [
        ZoneConfig(
            id="seminar_hall",
            name="Seminar Hall",
            light_state="on",
            polygon=[[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]],
        ),
        ZoneConfig(
            id="classroom",
            name="Classroom",
            light_state="off",
            polygon=[[0.5, 0.0], [1.0, 0.0], [1.0, 0.5], [0.5, 0.5]],
        ),
        ZoneConfig(
            id="lab",
            name="Lab",
            light_state="unknown",
            polygon=[[0.0, 0.5], [0.5, 0.5], [0.5, 1.0], [0.0, 1.0]],
        ),
        ZoneConfig(
            id="office",
            name="Office",
            light_state="on",
            polygon=[[0.5, 0.5], [1.0, 0.5], [1.0, 1.0], [0.5, 1.0]],
        ),
    ]


@pytest.fixture()
def minimal_valid_config(four_quadrant_zones) -> CVConfig:
    """A minimal, fully valid CVConfig for testing."""
    cfg = CVConfig()
    cfg.video_source = VideoSourceConfig(
        path="test_video.mp4",
        loop=False,
        target_fps=3.0,
        inference_width=640,
        inference_height=384,
    )
    cfg.model = ModelConfig(
        weights="yolov8n.pt",
        confidence_threshold=0.35,
        iou_threshold=0.45,
        person_class_id=0,
    )
    cfg.tracker = TrackerConfig(type="bytetrack")
    cfg.stabilization = StabilizationConfig(window_size=5, method="mode")
    cfg.zones = four_quadrant_zones
    cfg.publisher = PublisherConfig(
        type="stdout",
        periodic_interval_seconds=10.0,
        min_publish_interval_seconds=1.0,
    )
    cfg.health = HealthConfig(degraded_after_missed_frames=3, failed_after_missed_frames=10)
    cfg.logging = LoggingConfig(level="INFO")
    return cfg


# ---------------------------------------------------------------------------
# Detection helpers
# ---------------------------------------------------------------------------


def make_detection(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    confidence: float = 0.9,
    track_id: int = 1,
) -> Detection:
    """Helper: create a Detection with a bottom-center at the given bbox."""
    return Detection(x1=x1, y1=y1, x2=x2, y2=y2, confidence=confidence, track_id=track_id)


def detection_at_norm(
    nx: float,
    ny: float,
    frame_width: int = 640,
    frame_height: int = 384,
    track_id: int = 1,
) -> Detection:
    """Create a detection whose bottom-center maps to normalized point (nx, ny)."""
    px = nx * frame_width
    py = ny * frame_height
    # Small box above the bottom-center point
    return Detection(
        x1=px - 10,
        y1=py - 40,
        x2=px + 10,
        y2=py,
        confidence=0.9,
        track_id=track_id,
    )
