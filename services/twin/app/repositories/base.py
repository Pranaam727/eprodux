from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from app.models.schemas import (
    CameraHealthInput,
    LightingInput,
    OccupancyEvent,
    RoomState,
)


class TwinRepository(ABC):
    """Abstract storage interface for digital-twin state, event history, and metadata."""

    @abstractmethod
    def get_building_metadata(self) -> Dict[str, Any]:
        """Return top-level building & floor configuration."""
        pass

    @abstractmethod
    def get_room_state(self, room_id: str) -> Optional[RoomState]:
        """Fetch current room state snapshot."""
        pass

    @abstractmethod
    def get_all_room_states(self) -> List[RoomState]:
        """Fetch state snapshots for all rooms in canonical order."""
        pass

    @abstractmethod
    def save_room_state(self, room_state: RoomState) -> None:
        """Persist updated room state."""
        pass

    @abstractmethod
    def has_event_id(self, event_id: str) -> bool:
        """Check if event ID was previously processed."""
        pass

    @abstractmethod
    def record_event_id(self, event_id: str) -> None:
        """Record processed event ID for deduplication."""
        pass

    @abstractmethod
    def record_occupancy_event(self, event: OccupancyEvent) -> None:
        """Record occupancy event in historical log."""
        pass

    @abstractmethod
    def get_occupancy_events(self, room_id: Optional[str] = None) -> List[OccupancyEvent]:
        """Retrieve recorded historical occupancy events."""
        pass

    @abstractmethod
    def record_lighting_input(self, input_data: LightingInput) -> None:
        """Record lighting input update."""
        pass

    @abstractmethod
    def record_camera_health_input(self, input_data: CameraHealthInput) -> None:
        """Record camera health update."""
        pass

    @abstractmethod
    def get_observation_window(self) -> Tuple[Optional[datetime], Optional[datetime]]:
        """Return (earliest_event_time, latest_event_time) across all ingested events."""
        pass

    @abstractmethod
    def get_rated_power_w(self, room_id: str) -> Optional[float]:
        """Return lighting rated power in watts for the room, or None if unspecified."""
        pass

    @abstractmethod
    def reset(self) -> None:
        """Reset state back to initial state (used for testing or clean restart)."""
        pass
