"""event_schema.py — CV event dataclass and JSON serialization.

Canonical event contract (agreed with team):

    {
      "zone_id": "seminar_hall",
      "timestamp": "2026-10-15T10:30:00Z",
      "occupancy": 3,
      "light_state": "on",
      "confidence": 0.875
    }

Field definitions
-----------------
  zone_id     : Canonical room ID (seminar_hall | classroom | lab | office)
  timestamp   : Timezone-aware ISO 8601 UTC timestamp of event creation
  occupancy   : Current estimated count of people in the zone (>= 0)
  light_state : Manually supplied lighting state — on | off | unknown
                NEVER inferred from image brightness.
  confidence  : Count-stability score in [0.0, 1.0].
                Fraction of stabilization-window frames that agreed on
                the published occupancy. NOT a calibrated probability.

Integration note
----------------
  If the backend or MQTT interface requires additional fields, do NOT
  change this schema without team approval. Document the gap and propose
  a backward-compatible extension.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone

from cv.src.config import VALID_LIGHT_STATES


# ---------------------------------------------------------------------------
# CVEvent dataclass
# ---------------------------------------------------------------------------


@dataclass
class CVEvent:
    zone_id: str
    timestamp: str          # ISO 8601 UTC string
    occupancy: int
    light_state: str        # "on" | "off" | "unknown"
    confidence: float       # [0.0, 1.0]

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    def create(
        cls,
        zone_id: str,
        occupancy: int,
        light_state: str,
        confidence: float,
        ts: datetime | None = None,
    ) -> "CVEvent":
        """Create a CVEvent with a UTC timestamp.

        If ts is None, the current UTC time is used.
        """
        if ts is None:
            ts = datetime.now(tz=timezone.utc)
        elif ts.tzinfo is None:
            raise ValueError(
                "Naive datetime passed to CVEvent.create(). "
                "Always use timezone-aware datetimes."
            )
        return cls(
            zone_id=zone_id,
            timestamp=ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
            occupancy=occupancy,
            light_state=light_state,
            confidence=round(float(confidence), 6),
        )

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self, indent: int | None = None) -> str:
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_dict(cls, d: dict) -> "CVEvent":
        return cls(
            zone_id=str(d["zone_id"]),
            timestamp=str(d["timestamp"]),
            occupancy=int(d["occupancy"]),
            light_state=str(d["light_state"]),
            confidence=float(d["confidence"]),
        )

    @classmethod
    def from_json(cls, s: str) -> "CVEvent":
        return cls.from_dict(json.loads(s))

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def validate(self) -> list[str]:
        """Return a list of validation error strings. Empty means valid."""
        errors: list[str] = []

        if not self.zone_id:
            errors.append("zone_id must not be empty")

        if not self.timestamp:
            errors.append("timestamp must not be empty")
        else:
            try:
                # Must parse and have UTC 'Z' suffix
                if not self.timestamp.endswith("Z"):
                    errors.append(
                        f"timestamp must end with 'Z' (UTC), got: {self.timestamp!r}"
                    )
                datetime.strptime(self.timestamp, "%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                errors.append(
                    f"timestamp is not valid ISO 8601 UTC: {self.timestamp!r}"
                )

        if self.occupancy < 0:
            errors.append(f"occupancy must be >= 0, got {self.occupancy}")

        if self.light_state not in VALID_LIGHT_STATES:
            errors.append(
                f"light_state must be one of {sorted(VALID_LIGHT_STATES)}, "
                f"got {self.light_state!r}"
            )

        if not (0.0 <= self.confidence <= 1.0):
            errors.append(
                f"confidence must be in [0.0, 1.0], got {self.confidence}"
            )

        return errors

    def is_valid(self) -> bool:
        return len(self.validate()) == 0
