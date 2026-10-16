import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from app.models.schemas import (
    CANONICAL_ROOM_IDS,
    CameraHealthInput,
    LightingInput,
    OccupancyEvent,
    RoomState,
)
from app.repositories.base import TwinRepository
from app.services.mock_provider import (
    generate_initial_room_states,
    get_lighting_rated_power,
    load_building_config,
)


class InMemoryTwinRepository(TwinRepository):
    """
    Thread-safe, in-memory implementation of TwinRepository.
    Used for the Checkpoint 1 prototype. Designed as a swappable interface
    prior to introducing TimescaleDB/PostgreSQL persistence.
    """

    def __init__(self, building_json: Optional[Dict[str, Any]] = None):
        self._lock = threading.RLock()
        self._building_json = building_json or load_building_config()
        self._seen_event_ids: Set[str] = set()
        self._occupancy_events: List[OccupancyEvent] = []
        self._lighting_inputs: List[LightingInput] = []
        self._camera_health_inputs: List[CameraHealthInput] = []
        self._rated_powers: Dict[str, Optional[float]] = {}
        self._room_states: Dict[str, RoomState] = {}
        self._init_data()

    def _init_data(self) -> None:
        for rid in CANONICAL_ROOM_IDS:
            self._rated_powers[rid] = get_lighting_rated_power(rid, self._building_json)
        self._room_states = generate_initial_room_states(building_json=self._building_json)

    def get_building_metadata(self) -> Dict[str, Any]:
        with self._lock:
            floor = self._building_json.get("floors", [{}])[0]
            return {
                "building_id": self._building_json.get("building_id", "eprodux_bldg_01"),
                "floor_id": floor.get("floor_id", "floor_01"),
                "name": self._building_json.get("name", "Engineering Complex"),
                "floor_name": floor.get("name", "First Floor"),
            }

    def get_room_state(self, room_id: str) -> Optional[RoomState]:
        with self._lock:
            state = self._room_states.get(room_id)
            if state:
                return state.model_copy(deep=True)
            return None

    def get_all_room_states(self) -> List[RoomState]:
        with self._lock:
            # Preserve strict canonical order: seminar_hall, classroom, lab, office
            return [
                self._room_states[rid].model_copy(deep=True)
                for rid in CANONICAL_ROOM_IDS
                if rid in self._room_states
            ]

    def save_room_state(self, room_state: RoomState) -> None:
        with self._lock:
            self._room_states[room_state.room_id] = room_state.model_copy(deep=True)

    def has_event_id(self, event_id: str) -> bool:
        with self._lock:
            return event_id in self._seen_event_ids

    def record_event_id(self, event_id: str) -> None:
        with self._lock:
            self._seen_event_ids.add(event_id)

    def record_occupancy_event(self, event: OccupancyEvent) -> None:
        with self._lock:
            self._occupancy_events.append(event.model_copy())

    def get_occupancy_events(self, room_id: Optional[str] = None) -> List[OccupancyEvent]:
        with self._lock:
            if room_id:
                return [e.model_copy() for e in self._occupancy_events if e.zone_id == room_id]
            return [e.model_copy() for e in self._occupancy_events]

    def record_lighting_input(self, input_data: LightingInput) -> None:
        with self._lock:
            self._lighting_inputs.append(input_data.model_copy())

    def record_camera_health_input(self, input_data: CameraHealthInput) -> None:
        with self._lock:
            self._camera_health_inputs.append(input_data.model_copy())

    def get_observation_window(self) -> Tuple[Optional[datetime], Optional[datetime]]:
        with self._lock:
            all_timestamps: List[datetime] = []
            for ev in self._occupancy_events:
                all_timestamps.append(ev.timestamp)
            for li in self._lighting_inputs:
                all_timestamps.append(li.timestamp)
            for ch in self._camera_health_inputs:
                all_timestamps.append(ch.timestamp)
            
            # If no ingested events yet, use last_event_at from current mock states
            if not all_timestamps:
                for st in self._room_states.values():
                    if st.last_event_at:
                        all_timestamps.append(st.last_event_at)

            if not all_timestamps:
                return None, None
            return min(all_timestamps), max(all_timestamps)

    def get_rated_power_w(self, room_id: str) -> Optional[float]:
        with self._lock:
            return self._rated_powers.get(room_id)

    def reset(self) -> None:
        with self._lock:
            self._seen_event_ids.clear()
            self._occupancy_events.clear()
            self._lighting_inputs.clear()
            self._camera_health_inputs.clear()
            self._init_data()
