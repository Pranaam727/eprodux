"""video_source.py — Recorded-video frame source.

Supports:
  - Recorded video file (primary mode)
  - Loop / replay mode
  - Frame-skipping to hit a configurable target FPS
  - Webcam and RTSP are stub extensions (not fully implemented)

Privacy: frames are processed locally; never stored or transmitted.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Generator, Optional

logger = logging.getLogger(__name__)


class VideoSourceError(Exception):
    """Raised when a video source cannot be opened or validated."""


class FrameResult:
    """Container for one video frame."""

    __slots__ = ("frame", "frame_index", "timestamp_sec")

    def __init__(self, frame, frame_index: int, timestamp_sec: float) -> None:
        self.frame = frame
        self.frame_index = frame_index
        self.timestamp_sec = timestamp_sec


class VideoSource:
    """Iterate over frames from a recorded video file.

    Usage
    -----
    with VideoSource(path="video.mp4", target_fps=3) as src:
        for result in src.frames():
            process(result.frame)
    """

    def __init__(
        self,
        path: str,
        target_fps: float = 3.0,
        loop: bool = False,
        inference_width: int = 640,
        inference_height: int = 384,
    ) -> None:
        self._path = path
        self._target_fps = target_fps
        self._loop = loop
        self._inference_width = inference_width
        self._inference_height = inference_height
        self._cap = None
        self._native_fps: Optional[float] = None
        self._frame_width: Optional[int] = None
        self._frame_height: Optional[int] = None

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    def __enter__(self) -> "VideoSource":
        self.open()
        return self

    def __exit__(self, *_) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def open(self) -> None:
        """Open and validate the video source."""
        import cv2  # deferred so tests can run without OpenCV installed

        if not self._path:
            raise VideoSourceError("video_source.path is empty — provide a video file path.")

        p = Path(self._path)
        if not p.exists():
            raise VideoSourceError(f"Video file not found: {self._path}")
        if not p.is_file():
            raise VideoSourceError(f"Path is not a file: {self._path}")

        cap = cv2.VideoCapture(str(p))
        if not cap.isOpened():
            raise VideoSourceError(f"OpenCV could not open video: {self._path}")

        self._native_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        self._frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self._frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self._cap = cap

        logger.info(
            "[VideoSource] Opened %s | native %.1f fps | %dx%d | target %.1f fps | loop=%s",
            self._path,
            self._native_fps,
            self._frame_width,
            self._frame_height,
            self._target_fps,
            self._loop,
        )

    def close(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
            logger.info("[VideoSource] Released %s", self._path)

    # ------------------------------------------------------------------
    # Frame generation
    # ------------------------------------------------------------------

    def frames(self) -> Generator[FrameResult, None, None]:
        """Yield FrameResult objects, skipping frames to hit target_fps.

        Bounded strategy: we skip frames rather than buffering them,
        so the pipeline always processes the most current available frame.
        """
        import cv2

        if self._cap is None:
            raise VideoSourceError("VideoSource is not open — call open() first.")

        skip_every_n = max(1, round(self._native_fps / self._target_fps))
        frame_index = 0
        last_yield_time = time.perf_counter()

        while True:
            ret, frame = self._cap.read()

            if not ret:
                # End-of-file or unreadable frame
                if self._loop:
                    logger.debug("[VideoSource] EOF reached — looping.")
                    self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    frame_index = 0
                    continue
                else:
                    logger.info("[VideoSource] EOF reached — stopping.")
                    break

            frame_index += 1

            # Frame-skip: only yield every N-th frame
            if frame_index % skip_every_n != 0:
                continue

            # Resize to inference resolution
            if (
                self._inference_width != self._frame_width
                or self._inference_height != self._frame_height
            ):
                frame = cv2.resize(
                    frame,
                    (self._inference_width, self._inference_height),
                    interpolation=cv2.INTER_LINEAR,
                )

            fps = self._native_fps if (self._native_fps and self._native_fps > 0) else self._target_fps
            video_time_sec = frame_index / fps

            yield FrameResult(
                frame=frame,
                frame_index=frame_index,
                timestamp_sec=video_time_sec,
            )

            # Lightweight throttle so we don't spin if processing is very fast
            elapsed = time.perf_counter() - last_yield_time
            desired_interval = 1.0 / self._target_fps
            if elapsed < desired_interval:
                time.sleep(desired_interval - elapsed)
            last_yield_time = time.perf_counter()

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def native_fps(self) -> Optional[float]:
        return self._native_fps

    @property
    def frame_size(self) -> Optional[tuple[int, int]]:
        """Returns (width, height) of the original video."""
        if self._frame_width and self._frame_height:
            return (self._frame_width, self._frame_height)
        return None

    @property
    def inference_size(self) -> tuple[int, int]:
        return (self._inference_width, self._inference_height)

    @property
    def path(self) -> str:
        return self._path
