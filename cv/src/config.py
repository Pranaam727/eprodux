"""config.py — YAML configuration loader and validator for the CV component.

Canonical room IDs: seminar_hall, classroom, lab, office.
These IDs will be superseded by the repository's building.json if that file
is placed at the project root by another team member.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

import yaml

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Canonical room IDs — shared with all other Eprodux components.
# Do NOT rename these without team consensus.
# ---------------------------------------------------------------------------
CANONICAL_ROOM_IDS: frozenset[str] = frozenset(
    ["seminar_hall", "classroom", "lab", "office"]
)

VALID_LIGHT_STATES: frozenset[str] = frozenset(["on", "off", "unknown"])


# ---------------------------------------------------------------------------
# Typed sub-configs
# ---------------------------------------------------------------------------


@dataclass
class VideoSourceConfig:
    path: str = ""
    loop: bool = False
    target_fps: float = 3.0
    inference_width: int = 640
    inference_height: int = 384


@dataclass
class ModelConfig:
    weights: str = "yolov8n.pt"
    confidence_threshold: float = 0.35
    iou_threshold: float = 0.45
    person_class_id: int = 0


@dataclass
class TrackerConfig:
    type: str = "bytetrack"


@dataclass
class StabilizationConfig:
    window_size: int = 5
    method: str = "mode"  # "mode" | "median"


@dataclass
class ZoneConfig:
    id: str = ""
    name: str = ""
    light_state: str = "unknown"
    polygon: list[list[float]] = field(default_factory=list)


@dataclass
class PublisherConfig:
    type: str = "stdout"  # "stdout" | "file" | "http"
    output_file: str = "cv_events.jsonl"
    url: str = ""
    timeout_seconds: float = 2.0
    periodic_interval_seconds: float = 10.0
    min_publish_interval_seconds: float = 1.0


@dataclass
class HealthConfig:
    degraded_after_missed_frames: int = 3
    failed_after_missed_frames: int = 10
    log_health_changes: bool = True


@dataclass
class LoggingConfig:
    level: str = "INFO"


@dataclass
class CVConfig:
    video_source: VideoSourceConfig = field(default_factory=VideoSourceConfig)
    model: ModelConfig = field(default_factory=ModelConfig)
    tracker: TrackerConfig = field(default_factory=TrackerConfig)
    stabilization: StabilizationConfig = field(default_factory=StabilizationConfig)
    zones: list[ZoneConfig] = field(default_factory=list)
    publisher: PublisherConfig = field(default_factory=PublisherConfig)
    health: HealthConfig = field(default_factory=HealthConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------


def load_config(path: str) -> CVConfig:
    """Load and validate a YAML config file. Returns a CVConfig."""
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Config file not found: {path}")

    with open(path, "r", encoding="utf-8") as fh:
        raw: dict[str, Any] = yaml.safe_load(fh) or {}

    cfg = _parse(raw)
    _validate(cfg)
    return cfg


def default_config() -> CVConfig:
    """Return a default CVConfig with four placeholder zones."""
    cfg = CVConfig()
    cfg.zones = [
        ZoneConfig(
            id="seminar_hall",
            name="Seminar Hall",
            light_state="unknown",
            polygon=[[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]],
        ),
        ZoneConfig(
            id="classroom",
            name="Classroom",
            light_state="unknown",
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
            light_state="unknown",
            polygon=[[0.5, 0.5], [1.0, 0.5], [1.0, 1.0], [0.5, 1.0]],
        ),
    ]
    return cfg


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _parse(raw: dict[str, Any]) -> CVConfig:
    cfg = CVConfig()

    if vs := raw.get("video_source"):
        cfg.video_source = VideoSourceConfig(
            path=str(vs.get("path", "")),
            loop=bool(vs.get("loop", False)),
            target_fps=float(vs.get("target_fps", 3.0)),
            inference_width=int(vs.get("inference_width", 640)),
            inference_height=int(vs.get("inference_height", 384)),
        )

    if m := raw.get("model"):
        cfg.model = ModelConfig(
            weights=str(m.get("weights", "yolov8n.pt")),
            confidence_threshold=float(m.get("confidence_threshold", 0.35)),
            iou_threshold=float(m.get("iou_threshold", 0.45)),
            person_class_id=int(m.get("person_class_id", 0)),
        )

    if t := raw.get("tracker"):
        cfg.tracker = TrackerConfig(type=str(t.get("type", "bytetrack")))

    if s := raw.get("stabilization"):
        cfg.stabilization = StabilizationConfig(
            window_size=int(s.get("window_size", 5)),
            method=str(s.get("method", "mode")),
        )

    if zones_raw := raw.get("zones"):
        cfg.zones = [
            ZoneConfig(
                id=str(z.get("id", "")),
                name=str(z.get("name", "")),
                light_state=str(z.get("light_state", "unknown")),
                polygon=[[float(c[0]), float(c[1])] for c in z.get("polygon", [])],
            )
            for z in zones_raw
        ]

    if p := raw.get("publisher"):
        cfg.publisher = PublisherConfig(
            type=str(p.get("type", "stdout")),
            output_file=str(p.get("output_file", "cv_events.jsonl")),
            url=str(p.get("url", "")),
            timeout_seconds=float(p.get("timeout_seconds", 2.0)),
            periodic_interval_seconds=float(
                p.get("periodic_interval_seconds", 10.0)
            ),
            min_publish_interval_seconds=float(
                p.get("min_publish_interval_seconds", 1.0)
            ),
        )

    if h := raw.get("health"):
        cfg.health = HealthConfig(
            degraded_after_missed_frames=int(
                h.get("degraded_after_missed_frames", 3)
            ),
            failed_after_missed_frames=int(
                h.get("failed_after_missed_frames", 10)
            ),
            log_health_changes=bool(h.get("log_health_changes", True)),
        )

    if lg := raw.get("logging"):
        cfg.logging = LoggingConfig(level=str(lg.get("level", "INFO")))

    return cfg


def _validate(cfg: CVConfig) -> None:
    """Raise ValueError if the config contains obvious problems."""
    errors: list[str] = []

    # video
    if cfg.video_source.target_fps <= 0:
        errors.append("video_source.target_fps must be > 0")
    if cfg.video_source.inference_width <= 0 or cfg.video_source.inference_height <= 0:
        errors.append("inference_width and inference_height must be positive")

    # model
    if not (0.0 < cfg.model.confidence_threshold <= 1.0):
        errors.append("model.confidence_threshold must be in (0, 1]")
    if not (0.0 < cfg.model.iou_threshold <= 1.0):
        errors.append("model.iou_threshold must be in (0, 1]")

    # stabilization
    if cfg.stabilization.window_size < 1:
        errors.append("stabilization.window_size must be >= 1")
    if cfg.stabilization.method not in ("mode", "median"):
        errors.append("stabilization.method must be 'mode' or 'median'")

    # zones
    seen_ids: set[str] = set()
    for z in cfg.zones:
        if not z.id:
            errors.append("Each zone must have a non-empty 'id'")
        if z.id in seen_ids:
            errors.append(f"Duplicate zone id: {z.id!r}")
        seen_ids.add(z.id)

        if z.id and z.id not in CANONICAL_ROOM_IDS:
            logger.warning(
                "Zone id %r is not in the canonical room ID list %s. "
                "Ensure this is intentional.",
                z.id,
                sorted(CANONICAL_ROOM_IDS),
            )

        if z.light_state not in VALID_LIGHT_STATES:
            errors.append(
                f"Zone {z.id!r}: light_state must be one of "
                f"{sorted(VALID_LIGHT_STATES)}, got {z.light_state!r}"
            )

        if len(z.polygon) < 3:
            errors.append(
                f"Zone {z.id!r}: polygon must have at least 3 vertices, "
                f"got {len(z.polygon)}"
            )
        for i, pt in enumerate(z.polygon):
            if len(pt) != 2:
                errors.append(f"Zone {z.id!r}: vertex {i} must have exactly 2 values")
            else:
                x, y = pt
                if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
                    errors.append(
                        f"Zone {z.id!r}: vertex {i} ({x}, {y}) out of [0,1] range"
                    )

    # publisher
    if cfg.publisher.type not in ("stdout", "file", "http"):
        errors.append(
            f"publisher.type must be 'stdout', 'file', or 'http', "
            f"got {cfg.publisher.type!r}"
        )
    if cfg.publisher.periodic_interval_seconds <= 0:
        errors.append("publisher.periodic_interval_seconds must be > 0")

    # health
    if cfg.health.degraded_after_missed_frames >= cfg.health.failed_after_missed_frames:
        errors.append(
            "health.degraded_after_missed_frames must be < failed_after_missed_frames"
        )

    if errors:
        raise ValueError("CV config validation failed:\n" + "\n".join(f"  • {e}" for e in errors))
