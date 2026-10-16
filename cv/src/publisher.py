"""publisher.py — Publisher interface and built-in implementations.

The publisher is isolated behind a Protocol so the integration owner
(Member 2) can connect the backend or MQTT interface without rewriting
the CV pipeline.

Built-in publishers
-------------------
  StdoutPublisher  — prints JSON to stdout (default; no dependencies)
  FilePublisher    — appends JSON lines to a .jsonl file
  HttpPublisher    — POSTs to a backend URL (requires requests library)
  NullPublisher    — discards all events (useful in tests)

Duplicate suppression
---------------------
  EventPublishManager wraps any publisher and adds:
  - Per-zone minimum publish interval (suppresses high-frequency duplicates)
  - Periodic forced publish (so backend recovers from missed events)
  - State-change detection (publishes immediately when occupancy or
    light_state changes)
"""
from __future__ import annotations

import json
import logging
import sys
import time
from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable

from cv.src.event_schema import CVEvent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Publisher protocol (for type checking and mocking)
# ---------------------------------------------------------------------------


@runtime_checkable
class PublisherProtocol(Protocol):
    def publish(self, event: CVEvent) -> None:
        ...

    def close(self) -> None:
        ...


# ---------------------------------------------------------------------------
# Base class (ABC)
# ---------------------------------------------------------------------------


class BasePublisher(ABC):
    @abstractmethod
    def publish(self, event: CVEvent) -> None:
        """Publish one CV event. Must not raise on transient errors."""

    def close(self) -> None:
        """Release any held resources. Override if needed."""

    def __enter__(self) -> "BasePublisher":
        return self

    def __exit__(self, *_) -> None:
        self.close()


# ---------------------------------------------------------------------------
# StdoutPublisher
# ---------------------------------------------------------------------------


class StdoutPublisher(BasePublisher):
    """Print events as JSON to stdout. No external dependencies."""

    def __init__(self, indent: int | None = None) -> None:
        self._indent = indent

    def publish(self, event: CVEvent) -> None:
        print(event.to_json(indent=self._indent), flush=True)


# ---------------------------------------------------------------------------
# FilePublisher
# ---------------------------------------------------------------------------


class FilePublisher(BasePublisher):
    """Append events as JSON Lines to a file."""

    def __init__(self, path: str) -> None:
        self._path = path
        self._fh = open(path, "a", encoding="utf-8")
        logger.info("[Publisher] Writing events to %s", path)

    def publish(self, event: CVEvent) -> None:
        try:
            self._fh.write(event.to_json() + "\n")
            self._fh.flush()
        except OSError as exc:
            logger.error("[Publisher] Failed to write event: %s", exc)

    def close(self) -> None:
        if self._fh and not self._fh.closed:
            self._fh.close()


# ---------------------------------------------------------------------------
# NullPublisher (for tests and dry-runs)
# ---------------------------------------------------------------------------


class NullPublisher(BasePublisher):
    """Silently discard all events. Useful in tests."""

    def __init__(self) -> None:
        self.published: list[CVEvent] = []

    def publish(self, event: CVEvent) -> None:
        self.published.append(event)

    def close(self) -> None:
        pass


# ---------------------------------------------------------------------------
# HttpPublisher (integration placeholder — requires Member 2's backend)
# ---------------------------------------------------------------------------


class HttpPublisher(BasePublisher):
    """POST events to an HTTP endpoint.

    INTEGRATION DEPENDENCY: Requires Member 2's backend to be running.
    If the endpoint is unavailable, errors are logged but NOT raised,
    so the CV pipeline continues running.
    """

    def __init__(self, url: str, timeout: float = 2.0) -> None:
        self._url = url
        self._timeout = timeout
        logger.info("[Publisher] HTTP target: %s", url)

    def publish(self, event: CVEvent) -> None:
        try:
            import requests  # optional dependency

            resp = requests.post(
                self._url,
                json=event.to_dict(),
                timeout=self._timeout,
            )
            if not resp.ok:
                logger.warning(
                    "[Publisher] HTTP %s from %s: %s",
                    resp.status_code,
                    self._url,
                    resp.text[:200],
                )
        except Exception as exc:
            logger.error("[Publisher] HTTP publish failed: %s", exc)

    def close(self) -> None:
        pass


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def make_publisher(pub_config) -> BasePublisher:
    """Create a publisher from a PublisherConfig."""
    ptype = pub_config.type
    if ptype == "stdout":
        return StdoutPublisher()
    elif ptype == "file":
        return FilePublisher(pub_config.output_file)
    elif ptype == "http":
        return HttpPublisher(url=pub_config.url, timeout=pub_config.timeout_seconds)
    else:
        raise ValueError(f"Unknown publisher type: {ptype!r}")


# ---------------------------------------------------------------------------
# Duplicate suppression and periodic publishing manager
# ---------------------------------------------------------------------------


class EventPublishManager:
    """Wraps a publisher and adds duplicate suppression + periodic publish.

    Rules
    -----
    1. Publish immediately when occupancy or light_state changes for a zone.
    2. Suppress duplicate events within min_publish_interval_seconds.
    3. Force a publish after periodic_interval_seconds even if nothing changed
       (ensures backend can recover from missed events).
    """

    def __init__(
        self,
        publisher: BasePublisher,
        periodic_interval_seconds: float = 10.0,
        min_publish_interval_seconds: float = 1.0,
    ) -> None:
        self._publisher = publisher
        self._periodic_interval = periodic_interval_seconds
        self._min_interval = min_publish_interval_seconds

        # Per-zone tracking
        self._last_published: dict[str, CVEvent] = {}
        self._last_publish_time: dict[str, float] = {}
        self._last_periodic_time: dict[str, float] = {}

    def maybe_publish(self, event: CVEvent) -> bool:
        """Conditionally publish an event. Returns True if published."""
        zone_id = event.zone_id
        now = time.monotonic()

        last = self._last_published.get(zone_id)
        last_time = self._last_publish_time.get(zone_id, 0.0)
        last_periodic = self._last_periodic_time.get(zone_id, 0.0)

        # State changed?
        state_changed = (
            last is None
            or last.occupancy != event.occupancy
            or last.light_state != event.light_state
        )

        # Periodic forced publish?
        periodic_due = (now - last_periodic) >= self._periodic_interval

        # Minimum interval not yet elapsed?
        too_soon = (now - last_time) < self._min_interval

        if too_soon and not periodic_due:
            return False

        if state_changed or periodic_due:
            self._do_publish(event, now)
            if periodic_due:
                self._last_periodic_time[zone_id] = now
            return True

        return False

    def force_publish(self, event: CVEvent) -> None:
        """Publish unconditionally (e.g., health-change events)."""
        self._do_publish(event, time.monotonic())

    def _do_publish(self, event: CVEvent, now: float) -> None:
        zone_id = event.zone_id
        self._publisher.publish(event)
        self._last_published[zone_id] = event
        self._last_publish_time[zone_id] = now

    def close(self) -> None:
        self._publisher.close()
