"""detector.py — YOLO-based person detector.

Wraps the Ultralytics YOLO model for person detection.
The detector is designed to be mockable in tests — tests should NOT
download model weights. See tests/conftest.py for the mock fixture.

Privacy: No frames are stored or transmitted. Detection is local only.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

try:
    import numpy as np
except ImportError:
    np = None  # type: ignore

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Detection result type
# ---------------------------------------------------------------------------


@dataclass
class Detection:
    """One person detection from a single frame."""

    # Bounding box in pixel coordinates (inference-resolution space)
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    track_id: int = -1  # Assigned by tracker; -1 means untracked

    @property
    def bottom_center(self) -> tuple[float, float]:
        """Reference point used for zone assignment: bottom-center of bbox."""
        return ((self.x1 + self.x2) / 2.0, self.y2)

    @property
    def width(self) -> float:
        return self.x2 - self.x1

    @property
    def height(self) -> float:
        return self.y2 - self.y1


# ---------------------------------------------------------------------------
# Detector protocol (for mocking in tests)
# ---------------------------------------------------------------------------


@runtime_checkable
class DetectorProtocol(Protocol):
    def detect(self, frame: np.ndarray) -> list[Detection]:
        ...


# ---------------------------------------------------------------------------
# Real YOLO detector
# ---------------------------------------------------------------------------


class YOLODetector:
    """Person detector using a YOLO model via the Ultralytics library.

    This class wraps both detection and ByteTrack tracking, since Ultralytics
    exposes tracking as a first-class interface on the model object.

    Instantiate once and call detect_and_track() per frame.
    """

    def __init__(
        self,
        weights: str = "yolov8n.pt",
        confidence_threshold: float = 0.35,
        iou_threshold: float = 0.45,
        person_class_id: int = 0,
        tracker_type: str = "bytetrack",
    ) -> None:
        self._weights = weights
        self._conf = confidence_threshold
        self._iou = iou_threshold
        self._person_class_id = person_class_id
        self._tracker_type = tracker_type
        self._model = None

    def load(self) -> None:
        """Load YOLO model weights. Call once before processing."""
        from ultralytics import YOLO  # deferred: tests must not trigger this

        logger.info("[Detector] Loading YOLO model: %s", self._weights)
        self._model = YOLO(self._weights)
        logger.info("[Detector] Model loaded.")

    def detect_and_track(self, frame: np.ndarray) -> list[Detection]:
        """Run YOLO inference + ByteTrack on one frame.

        Returns a list of Detection objects with track_id set.
        An empty list is valid and means no people detected.
        """
        if self._model is None:
            raise RuntimeError("Call load() before detect_and_track().")

        try:
            results = self._model.track(
                source=frame,
                persist=True,
                tracker=f"{self._tracker_type}.yaml",
                classes=[self._person_class_id],
                conf=self._conf,
                iou=self._iou,
                verbose=False,
            )
        except Exception as exc:
            logger.error("[Detector] Inference error: %s", exc)
            return []

        detections: list[Detection] = []

        for result in results:
            if result.boxes is None:
                continue
            boxes = result.boxes

            for i in range(len(boxes)):
                try:
                    xyxy = boxes.xyxy[i].cpu().numpy()
                    conf_val = float(boxes.conf[i].cpu().numpy())

                    # Explicit verification: Ensure class is person class
                    if boxes.cls is not None:
                        c_id = int(boxes.cls[i].cpu().numpy())
                        if c_id != self._person_class_id:
                            continue

                    # Track ID: may be None if tracker hasn't assigned one yet
                    tid = -1
                    if boxes.id is not None:
                        raw_id = boxes.id[i]
                        if raw_id is not None:
                            tid = int(raw_id.cpu().numpy())

                    detections.append(
                        Detection(
                            x1=float(xyxy[0]),
                            y1=float(xyxy[1]),
                            x2=float(xyxy[2]),
                            y2=float(xyxy[3]),
                            confidence=conf_val,
                            track_id=tid,
                        )
                    )
                except Exception as exc:
                    logger.warning("[Detector] Skipping malformed detection: %s", exc)

        logger.debug("[Detector] Frame: %d detections", len(detections))
        return detections

    @property
    def is_loaded(self) -> bool:
        return self._model is not None
