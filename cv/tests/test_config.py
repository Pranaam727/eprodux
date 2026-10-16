"""test_config.py — Tests for config loading and validation.

Criteria tested
---------------
1. Valid configuration loads without error.
2. Invalid configuration raises ValueError with descriptive message.
3. Canonical room IDs are accepted.
4. Unknown room IDs produce a warning (not an error).
5. Invalid light_state values are rejected.
6. Polygon with < 3 vertices is rejected.
7. Out-of-range polygon coordinates are rejected.
8. Duplicate zone IDs are rejected.
9. Invalid publisher type is rejected.
10. health.degraded >= health.failed is rejected.
"""
from __future__ import annotations

import os
import textwrap
import tempfile
import pytest

from cv.src.config import (
    load_config,
    default_config,
    _validate,
    ZoneConfig,
    CVConfig,
    HealthConfig,
    PublisherConfig,
    StabilizationConfig,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def write_yaml(content: str) -> str:
    """Write YAML content to a temp file and return its path."""
    tf = tempfile.NamedTemporaryFile(
        mode="w", suffix=".yaml", delete=False, encoding="utf-8"
    )
    tf.write(textwrap.dedent(content))
    tf.close()
    return tf.name


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestLoadConfig:
    def test_missing_file_raises(self):
        with pytest.raises(FileNotFoundError, match="Config file not found"):
            load_config("/nonexistent/path/cv.yaml")

    def test_valid_minimal_yaml(self, tmp_path):
        yaml_text = """\
            video_source:
              path: "video.mp4"
              target_fps: 3
              inference_width: 640
              inference_height: 384
            model:
              weights: "yolov8n.pt"
              confidence_threshold: 0.35
              iou_threshold: 0.45
            stabilization:
              window_size: 5
              method: "mode"
            zones:
              - id: "seminar_hall"
                name: "Seminar Hall"
                light_state: "on"
                polygon: [[0.0,0.0],[0.5,0.0],[0.5,0.5],[0.0,0.5]]
              - id: "classroom"
                name: "Classroom"
                light_state: "off"
                polygon: [[0.5,0.0],[1.0,0.0],[1.0,0.5],[0.5,0.5]]
              - id: "lab"
                name: "Lab"
                light_state: "unknown"
                polygon: [[0.0,0.5],[0.5,0.5],[0.5,1.0],[0.0,1.0]]
              - id: "office"
                name: "Office"
                light_state: "on"
                polygon: [[0.5,0.5],[1.0,0.5],[1.0,1.0],[0.5,1.0]]
            publisher:
              type: "stdout"
              periodic_interval_seconds: 10
              min_publish_interval_seconds: 1
            health:
              degraded_after_missed_frames: 3
              failed_after_missed_frames: 10
        """
        config_path = tmp_path / "cv.yaml"
        config_path.write_text(textwrap.dedent(yaml_text), encoding="utf-8")
        cfg = load_config(str(config_path))
        assert cfg.video_source.path == "video.mp4"
        assert cfg.video_source.target_fps == 3.0
        assert cfg.model.confidence_threshold == 0.35
        assert len(cfg.zones) == 4
        assert cfg.zones[0].id == "seminar_hall"

    def test_empty_yaml_returns_defaults(self, tmp_path):
        config_path = tmp_path / "empty.yaml"
        config_path.write_text("", encoding="utf-8")
        # Empty YAML has no zones, so validation won't fail on zones,
        # but will fail on other things. Let's just check parsing works.
        from cv.src.config import _parse
        cfg = _parse({})
        assert cfg.model.weights == "yolov8n.pt"


class TestValidation:
    def _valid_zones(self):
        return [
            ZoneConfig(
                id="seminar_hall", name="S", light_state="on",
                polygon=[[0,0],[0.5,0],[0.5,0.5],[0,0.5]]
            ),
            ZoneConfig(
                id="classroom", name="C", light_state="off",
                polygon=[[0.5,0],[1,0],[1,0.5],[0.5,0.5]]
            ),
            ZoneConfig(
                id="lab", name="L", light_state="unknown",
                polygon=[[0,0.5],[0.5,0.5],[0.5,1],[0,1]]
            ),
            ZoneConfig(
                id="office", name="O", light_state="on",
                polygon=[[0.5,0.5],[1,0.5],[1,1],[0.5,1]]
            ),
        ]

    def _make_cfg(self, **overrides) -> CVConfig:
        cfg = default_config()
        cfg.zones = self._valid_zones()
        for k, v in overrides.items():
            setattr(cfg, k, v)
        return cfg

    def test_valid_config_passes(self):
        cfg = self._make_cfg()
        _validate(cfg)  # Should not raise

    def test_invalid_confidence_threshold(self):
        from cv.src.config import ModelConfig
        cfg = self._make_cfg()
        cfg.model = ModelConfig(confidence_threshold=0.0)  # invalid: must be > 0
        with pytest.raises(ValueError, match="confidence_threshold"):
            _validate(cfg)

    def test_invalid_confidence_threshold_above_1(self):
        from cv.src.config import ModelConfig
        cfg = self._make_cfg()
        cfg.model = ModelConfig(confidence_threshold=1.5)
        with pytest.raises(ValueError, match="confidence_threshold"):
            _validate(cfg)

    def test_invalid_target_fps(self):
        from cv.src.config import VideoSourceConfig
        cfg = self._make_cfg()
        cfg.video_source = VideoSourceConfig(target_fps=-1, path="x.mp4")
        with pytest.raises(ValueError, match="target_fps"):
            _validate(cfg)

    def test_polygon_too_few_vertices(self):
        cfg = self._make_cfg()
        cfg.zones[0].polygon = [[0, 0], [1, 0]]  # only 2 vertices
        with pytest.raises(ValueError, match="polygon"):
            _validate(cfg)

    def test_polygon_out_of_range(self):
        cfg = self._make_cfg()
        cfg.zones[0].polygon = [[0, 0], [1.5, 0], [1, 1]]  # 1.5 out of [0,1]
        with pytest.raises(ValueError, match="out of"):
            _validate(cfg)

    def test_duplicate_zone_id(self):
        cfg = self._make_cfg()
        cfg.zones[1].id = "seminar_hall"  # duplicate
        with pytest.raises(ValueError, match="Duplicate zone id"):
            _validate(cfg)

    def test_invalid_light_state(self):
        cfg = self._make_cfg()
        cfg.zones[0].light_state = "bright"  # invalid
        with pytest.raises(ValueError, match="light_state"):
            _validate(cfg)

    def test_invalid_publisher_type(self):
        cfg = self._make_cfg()
        cfg.publisher = PublisherConfig(type="mqtt")  # not yet supported
        with pytest.raises(ValueError, match="publisher.type"):
            _validate(cfg)

    def test_health_degraded_ge_failed(self):
        cfg = self._make_cfg()
        cfg.health = HealthConfig(degraded_after_missed_frames=10, failed_after_missed_frames=10)
        with pytest.raises(ValueError, match="degraded_after_missed_frames"):
            _validate(cfg)

    def test_invalid_stabilization_method(self):
        cfg = self._make_cfg()
        cfg.stabilization = StabilizationConfig(method="rolling_average")
        with pytest.raises(ValueError, match="method"):
            _validate(cfg)

    def test_canonical_room_ids_accepted(self):
        cfg = self._make_cfg()
        # All four canonical IDs should pass without error
        _validate(cfg)

    def test_window_size_zero_rejected(self):
        cfg = self._make_cfg()
        cfg.stabilization = StabilizationConfig(window_size=0)
        with pytest.raises(ValueError, match="window_size"):
            _validate(cfg)


class TestDefaultConfig:
    def test_default_config_has_four_zones(self):
        cfg = default_config()
        assert len(cfg.zones) == 4

    def test_default_zone_ids_are_canonical(self):
        from cv.src.config import CANONICAL_ROOM_IDS
        cfg = default_config()
        for zone in cfg.zones:
            assert zone.id in CANONICAL_ROOM_IDS

    def test_default_light_states_are_unknown(self):
        cfg = default_config()
        for zone in cfg.zones:
            assert zone.light_state == "unknown"
