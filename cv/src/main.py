"""main.py — CV pipeline entry point.

Usage
-----
  python -m cv.src.main --config cv/config/cv.yaml
  python -m cv.src.main --config cv/config/cv.yaml --video path/to/video.mp4
  python -m cv.src.main --video path/to/video.mp4 --publisher stdout

Health contract
---------------
  When the video source fails (health.is_failed), the pipeline stops
  publishing fresh occupancy events and logs the failure clearly.
  It does NOT emit a zero-occupancy event for a failed source.

Privacy
-------
  Frames are processed locally. Nothing is stored or transmitted externally
  (except metadata events to the configured publisher).
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from cv.src.config import load_config, default_config, CVConfig
from cv.src.video_source import VideoSource, VideoSourceError
from cv.src.detector import YOLODetector
from cv.src.zones import ZoneManager
from cv.src.occupancy import OccupancyStabilizer
from cv.src.event_schema import CVEvent
from cv.src.publisher import make_publisher, EventPublishManager, NullPublisher
from cv.src.health import CameraHealth, HealthState

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Eprodux CV pipeline — occupancy monitoring from recorded video.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m cv.src.main --config cv/config/cv.yaml
  python -m cv.src.main --config cv/config/cv.yaml --video demo.mp4
  python -m cv.src.main --video demo.mp4 --publisher stdout
""",
    )
    p.add_argument("--config", type=str, help="Path to YAML config file.")
    p.add_argument("--video", type=str, help="Override video path from config.")
    p.add_argument(
        "--publisher",
        choices=["stdout", "file", "null"],
        help="Override publisher type (stdout | file | null).",
    )
    p.add_argument("--loop", action="store_true", help="Loop video indefinitely.")
    p.add_argument("--log-level", default=None, help="Logging level (DEBUG, INFO, ...).")
    return p


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


def run_pipeline(cfg: CVConfig, video_override: str | None = None) -> None:
    """Main CV pipeline. Blocks until video ends or KeyboardInterrupt."""

    # --- Logging setup ---
    log_level = getattr(logging, cfg.logging.level.upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    )

    # --- Video path ---
    video_path = video_override or cfg.video_source.path
    if not video_path:
        logger.error(
            "No video path specified. Provide 'video_source.path' in config "
            "or use --video on the command line."
        )
        sys.exit(1)

    # --- Zone manager ---
    zone_manager = ZoneManager.from_configs(
        cfg.zones,
        frame_width=cfg.video_source.inference_width,
        frame_height=cfg.video_source.inference_height,
    )
    zone_ids = zone_manager.zone_ids

    # --- Stabilizer ---
    stabilizer = OccupancyStabilizer(
        zone_ids=zone_ids,
        window_size=cfg.stabilization.window_size,
        method=cfg.stabilization.method,
    )

    # --- Publisher ---
    raw_publisher = make_publisher(cfg.publisher)
    pub_manager = EventPublishManager(
        publisher=raw_publisher,
        periodic_interval_seconds=cfg.publisher.periodic_interval_seconds,
        min_publish_interval_seconds=cfg.publisher.min_publish_interval_seconds,
    )

    # --- Health monitor ---
    health = CameraHealth(
        degraded_after=cfg.health.degraded_after_missed_frames,
        failed_after=cfg.health.failed_after_missed_frames,
        log_changes=cfg.health.log_health_changes,
    )

    # --- Detector (YOLO + ByteTrack) ---
    detector = YOLODetector(
        weights=cfg.model.weights,
        confidence_threshold=cfg.model.confidence_threshold,
        iou_threshold=cfg.model.iou_threshold,
        person_class_id=cfg.model.person_class_id,
        tracker_type=cfg.tracker.type,
    )

    logger.info("[Pipeline] Loading YOLO model: %s", cfg.model.weights)
    try:
        detector.load()
    except Exception as exc:
        logger.error("[Pipeline] Failed to load YOLO model: %s", exc)
        sys.exit(1)

    # --- Video source ---
    source = VideoSource(
        path=video_path,
        target_fps=cfg.video_source.target_fps,
        loop=cfg.video_source.loop,
        inference_width=cfg.video_source.inference_width,
        inference_height=cfg.video_source.inference_height,
    )

    try:
        source.open()
    except VideoSourceError as exc:
        logger.error("[Pipeline] Cannot open video: %s", exc)
        sys.exit(1)

    # --- Main loop ---
    frame_count = 0
    perf_start = time.perf_counter()

    logger.info("[Pipeline] Starting. Video: %s", video_path)

    try:
        with source:
            for frame_result in source.frames():
                frame_count += 1

                # Run detection + tracking
                try:
                    detections = detector.detect_and_track(frame_result.frame)
                    health.record_good_frame()
                except Exception as exc:
                    logger.error("[Pipeline] Detection error on frame %d: %s", frame_count, exc)
                    health.record_bad_frame()
                    continue

                if health.is_failed:
                    # Source unhealthy — do not emit stale counts as fresh events
                    logger.error(
                        "[Pipeline] Source health=FAILED. Suppressing occupancy events."
                    )
                    continue

                # Count per zone
                raw_counts = zone_manager.count_occupancy(detections)

                # Stabilize
                stabilized = stabilizer.update(raw_counts)

                # Publish events
                now_utc = datetime.now(tz=timezone.utc)
                for zone_id, (occ, conf) in stabilized.items():
                    zone = zone_manager.get_zone(zone_id)
                    light = zone.light_state if zone else "unknown"

                    event = CVEvent.create(
                        zone_id=zone_id,
                        occupancy=occ,
                        light_state=light,
                        confidence=conf,
                        ts=now_utc,
                    )
                    pub_manager.maybe_publish(event)

                # Periodic throughput log
                if frame_count % 50 == 0:
                    elapsed = time.perf_counter() - perf_start
                    fps = frame_count / elapsed if elapsed > 0 else 0.0
                    logger.info(
                        "[PERF] frames=%d  elapsed=%.1fs  throughput=%.2f fps",
                        frame_count,
                        elapsed,
                        fps,
                    )

    except KeyboardInterrupt:
        logger.info("[Pipeline] Interrupted by user.")
    finally:
        elapsed = time.perf_counter() - perf_start
        fps = frame_count / elapsed if elapsed > 0 else 0.0
        logger.info(
            "[Pipeline] Done. frames=%d  elapsed=%.1fs  avg_fps=%.2f",
            frame_count,
            elapsed,
            fps,
        )
        pub_manager.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    # Load config
    if args.config:
        cfg = load_config(args.config)
    else:
        cfg = default_config()
        logger.warning("No --config provided; using built-in defaults.")

    # Apply CLI overrides
    if args.video:
        cfg.video_source.path = args.video
    if args.loop:
        cfg.video_source.loop = True
    if args.publisher:
        cfg.publisher.type = args.publisher
    if args.log_level:
        cfg.logging.level = args.log_level.upper()

    run_pipeline(cfg, video_override=args.video)


if __name__ == "__main__":
    main()
