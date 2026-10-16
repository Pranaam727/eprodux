"""
Core Digital Twin Service.
Manages building state, ingestion safety rules, staleness checks,
deterministic idle-lit anomaly detection, and summary aggregation.
"""
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Dict, List, Optional
from app.config import settings
from app.models.schemas import (
    CANONICAL_ROOM_IDS,
    AnomalyAlert,
    BuildingStateSnapshot,
    CameraHealthInput,
    DailySummary,
    DailySummaryMetrics,
    EnergyReadings,
    LightingInput,
    ObservationWindow,
    OccupancyEvent,
    RoomProvenance,
    RoomState,
    RoomSummaryMetric,
)
from app.repositories.base import TwinRepository
from app.services.energy_service import estimate_lighting_waste_kwh


class TwinService:
    def __init__(
        self,
        repository: TwinRepository,
        on_state_change_callback: Optional[Callable[[BuildingStateSnapshot], None]] = None,
    ):
        self.repo = repository
        self.on_state_change = on_state_change_callback
        # Track initial vacancy start times for accurate duration tracking
        self._vacancy_start_times: Dict[str, datetime] = {}
        # Track cumulative idle-lit waste seconds per room across the session
        self._waste_seconds_accumulated: Dict[str, float] = {rid: 0.0 for rid in CANONICAL_ROOM_IDS}
        self._initialize_vacancy_timers()

    def _initialize_vacancy_timers(self) -> None:
        """Seed vacancy start times for rooms initially empty."""
        for state in self.repo.get_all_room_states():
            if state.occupancy_status == "known" and state.occupancy == 0 and state.vacancy_seconds:
                ref_time = state.last_event_at or datetime.now(timezone.utc)
                self._vacancy_start_times[state.room_id] = ref_time - timedelta(
                    seconds=state.vacancy_seconds
                )

    def evaluate_room_anomalies(self, state: RoomState, now: datetime) -> List[AnomalyAlert]:
        """
        Deterministic Anomaly Rule: Sustained Idle-Lit Room.
        Triggered ONLY when:
        1. Room occupancy status is known.
        2. Latest occupancy == 0.
        3. Camera is online and fresh (not stale).
        4. Confidence >= min_confidence_threshold.
        5. Light state is explicitly 'on'.
        6. Vacancy duration >= idle_lit_threshold_seconds.
        """
        anomalies: List[AnomalyAlert] = []

        # Check suppression conditions
        if (
            state.occupancy_status != "known"
            or state.occupancy is None
            or state.occupancy > 0
            or state.camera_status != "online"
            or state.light_state != "on"
            or (state.confidence is not None and state.confidence < settings.min_confidence_threshold)
        ):
            return anomalies

        # Check staleness against event timestamp
        if state.last_event_at is not None:
            age = (now - state.last_event_at).total_seconds()
            if age > settings.stale_threshold_seconds:
                return anomalies

        # Check vacancy duration
        vacancy_sec = state.vacancy_seconds or 0.0
        if vacancy_sec >= settings.idle_lit_threshold_seconds:
            rated_power = self.repo.get_rated_power_w(state.room_id)
            anomalies.append(
                AnomalyAlert(
                    rule_id="sustained_idle_lit",
                    severity="warning",
                    message=(
                        f"Room {state.name} has been verified vacant for {vacancy_sec:.1f}s "
                        f"with lights ON (threshold: {settings.idle_lit_threshold_seconds:.1f}s)."
                    ),
                    raised_at=now,
                    evidence={
                        "room_id": state.room_id,
                        "vacancy_seconds": vacancy_sec,
                        "threshold_seconds": settings.idle_lit_threshold_seconds,
                        "light_state": state.light_state,
                        "rated_power_w": rated_power,
                        "confidence": state.confidence,
                    },
                )
            )

        return anomalies

    def refresh_room_staleness(self, state: RoomState, now: datetime) -> RoomState:
        """
        Safety check: if camera was marked online but no events have arrived
        within stale_threshold_seconds, transition camera to 'stale' and occupancy to 'unknown'.
        """
        if state.camera_status == "online" and state.last_event_at is not None:
            age = (now - state.last_event_at).total_seconds()
            if age > settings.stale_threshold_seconds:
                state.camera_status = "stale"
                state.occupancy = None
                state.occupancy_status = "unknown"
                state.confidence = None
                state.vacancy_seconds = None
                if state.room_id in self._vacancy_start_times:
                    del self._vacancy_start_times[state.room_id]
        return state

    def get_building_snapshot(self, now: Optional[datetime] = None) -> BuildingStateSnapshot:
        """Return the current validated snapshot across all four rooms."""
        if now is None:
            now = datetime.now(timezone.utc)

        meta = self.repo.get_building_metadata()
        rooms = self.repo.get_all_room_states()
        refreshed_rooms: List[RoomState] = []

        for room in rooms:
            ref_time = max(now, room.last_event_at) if room.last_event_at else now
            refreshed = self.refresh_room_staleness(room, ref_time)
            # Update vacancy seconds if room is currently known vacant
            if (
                refreshed.occupancy_status == "known"
                and refreshed.occupancy == 0
                and refreshed.room_id in self._vacancy_start_times
            ):
                start_time = self._vacancy_start_times[refreshed.room_id]
                refreshed.vacancy_seconds = max(0.0, (ref_time - start_time).total_seconds())

            # Evaluate anomalies
            refreshed.anomalies = self.evaluate_room_anomalies(refreshed, ref_time)

            # Persist refreshed room state
            self.repo.save_room_state(refreshed)
            refreshed_rooms.append(refreshed)

        return BuildingStateSnapshot(
            building_id=meta["building_id"],
            floor_id=meta["floor_id"],
            updated_at=now,
            run_mode=settings.run_mode,  # type: ignore[arg-type]
            rooms=refreshed_rooms,
        )

    def handle_occupancy_event(
        self, event: OccupancyEvent, now: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Core CV occupancy event processor. Transport-independent so it can be called
        from both HTTP POST and future MQTT consumer without modifications.
        """
        if now is None:
            now = datetime.now(timezone.utc)

        room_id = event.zone_id
        if room_id not in CANONICAL_ROOM_IDS:
            raise ValueError(f"Unknown room identifier: {room_id}")

        # Deduplication
        if self.repo.has_event_id(event.event_id):
            return {
                "status": "accepted",
                "event_id": event.event_id,
                "room_id": room_id,
                "deduplicated": True,
                "message": "Event already processed; state unchanged.",
            }

        # Fetch current state
        state = self.repo.get_room_state(room_id)
        if state is None:
            raise ValueError(f"Room state not found for {room_id}")

        # Out-of-order check: do not let an older event overwrite newer state
        if state.last_event_at is not None and event.timestamp < state.last_event_at:
            self.repo.record_event_id(event.event_id)
            return {
                "status": "ignored",
                "event_id": event.event_id,
                "room_id": room_id,
                "deduplicated": False,
                "message": (
                    f"Out-of-order event rejected. Event timestamp ({event.timestamp}) "
                    f"is older than latest room state ({state.last_event_at})."
                ),
            }

        # Apply update
        self.repo.record_event_id(event.event_id)
        self.repo.record_occupancy_event(event)

        state.occupancy = event.occupancy
        state.occupancy_status = "known"
        state.confidence = event.confidence
        state.camera_status = "online"
        state.last_event_at = event.timestamp
        state.provenance.occupancy = event.source

        # Vacancy tracking
        if event.occupancy == 0:
            if room_id not in self._vacancy_start_times:
                self._vacancy_start_times[room_id] = event.timestamp
            start_t = self._vacancy_start_times[room_id]
            state.vacancy_seconds = max(0.0, (event.timestamp - start_t).total_seconds())
        else:
            state.vacancy_seconds = None
            if room_id in self._vacancy_start_times:
                del self._vacancy_start_times[room_id]

        # Evaluate anomalies
        state.anomalies = self.evaluate_room_anomalies(state, event.timestamp)
        self.repo.save_room_state(state)

        # Notify snapshot update
        snapshot = self.get_building_snapshot(now=now)
        if self.on_state_change:
            self.on_state_change(snapshot)

        return {
            "status": "accepted",
            "event_id": event.event_id,
            "room_id": room_id,
            "deduplicated": False,
            "message": "Occupancy event processed successfully.",
        }

    def handle_lighting_input(
        self, input_data: LightingInput, now: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Handle manual or simulated lighting updates.
        Strictly decoupled from CV occupancy detection.
        """
        if now is None:
            now = datetime.now(timezone.utc)

        room_id = input_data.room_id
        if room_id not in CANONICAL_ROOM_IDS:
            raise ValueError(f"Unknown room identifier: {room_id}")

        state = self.repo.get_room_state(room_id)
        if state is None:
            raise ValueError(f"Room state not found for {room_id}")

        self.repo.record_lighting_input(input_data)
        state.light_state = input_data.light_state
        state.light_source = input_data.source
        state.provenance.lighting = input_data.source

        # Update energy data reflection based on lighting rated power
        rated_power = self.repo.get_rated_power_w(room_id)
        if input_data.light_state == "on":
            state.energy_data = EnergyReadings(
                estimated_current_power_w=rated_power,
                provenance="calculated" if rated_power is not None else "simulated",
                calculation_basis="rated_lighting_power" if rated_power is not None else None,
            )
        elif input_data.light_state == "off":
            state.energy_data = EnergyReadings(
                estimated_current_power_w=0.0,
                provenance="calculated",
                calculation_basis="lights_off",
            )
        else:
            state.energy_data = None

        # Re-evaluate anomalies for this room
        state.anomalies = self.evaluate_room_anomalies(state, now)
        self.repo.save_room_state(state)

        snapshot = self.get_building_snapshot(now=now)
        if self.on_state_change:
            self.on_state_change(snapshot)

        return {
            "status": "accepted",
            "room_id": room_id,
            "light_state": state.light_state,
            "source": state.light_source,
        }

    def handle_camera_health(
        self, health_data: CameraHealthInput, now: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Handle camera health updates.
        If camera is offline, occupancy immediately transitions to unknown.
        """
        if now is None:
            now = datetime.now(timezone.utc)

        room_id = health_data.room_id
        if room_id not in CANONICAL_ROOM_IDS:
            raise ValueError(f"Unknown room identifier: {room_id}")

        state = self.repo.get_room_state(room_id)
        if state is None:
            raise ValueError(f"Room state not found for {room_id}")

        self.repo.record_camera_health_input(health_data)
        state.camera_status = health_data.status
        state.provenance.camera_health = health_data.source

        if health_data.status == "offline":
            state.occupancy = None
            state.occupancy_status = "unknown"
            state.confidence = None
            state.vacancy_seconds = None
            if room_id in self._vacancy_start_times:
                del self._vacancy_start_times[room_id]

        state.anomalies = self.evaluate_room_anomalies(state, now)
        self.repo.save_room_state(state)

        snapshot = self.get_building_snapshot(now=now)
        if self.on_state_change:
            self.on_state_change(snapshot)

        return {
            "status": "accepted",
            "room_id": room_id,
            "camera_status": state.camera_status,
            "occupancy_status": state.occupancy_status,
        }

    def get_daily_summary(
        self, period: str = "day", now: Optional[datetime] = None
    ) -> DailySummary:
        """
        Compute daily summary from available observations.
        Explicitly exposes observation window, coverage, and mock provenance.
        Never manufactures a full day's observations.
        """
        if now is None:
            now = datetime.now(timezone.utc)

        start_time, end_time = self.repo.get_observation_window()
        if start_time is None:
            start_time = now
        if end_time is None or end_time < start_time:
            end_time = now

        duration_seconds = max(0.0, (end_time - start_time).total_seconds())
        # Target 24h = 86,400 seconds
        coverage_ratio = min(1.0, duration_seconds / 86400.0)

        is_complete = coverage_ratio >= 0.95
        completeness_status = (
            "complete"
            if is_complete
            else ("insufficient_data" if duration_seconds < 60.0 else "incomplete")
        )

        notes: List[str] = []
        if not is_complete:
            notes.append(
                f"Observation window covers {duration_seconds / 3600.0:.2f} hours "
                f"({coverage_ratio * 100.0:.1f}% of 24-hour target). History is incomplete."
            )
        if settings.run_mode == "mock":
            notes.append(
                "Data provenance: In-memory mock prototype. Metrics reflect simulated scenario."
            )
        notes.append(
            "TimescaleDB historical aggregation will replace in-memory rollups in subsequent checkpoints."
        )

        room_metrics: List[RoomSummaryMetric] = []
        total_waste_hours = 0.0
        total_estimated_waste_kwh = 0.0

        for state in self.repo.get_all_room_states():
            # Calculate waste duration if currently idle-lit
            waste_sec = (
                state.vacancy_seconds
                if (state.occupancy_status == "known" and state.occupancy == 0 and state.light_state == "on")
                else 0.0
            ) or 0.0
            waste_h = waste_sec / 3600.0
            rated_power = self.repo.get_rated_power_w(state.room_id)
            room_waste_kwh = estimate_lighting_waste_kwh(rated_power, waste_sec) or 0.0

            # Compute utilization rate from recorded occupancy events
            events = self.repo.get_occupancy_events(state.room_id)
            if events:
                occupied_count = sum(1 for e in events if e.occupancy > 0)
                utilization_rate = occupied_count / float(len(events))
            else:
                utilization_rate = 1.0 if (state.occupancy and state.occupancy > 0) else 0.0

            total_waste_hours += waste_h
            total_estimated_waste_kwh += room_waste_kwh

            room_metrics.append(
                RoomSummaryMetric(
                    room_id=state.room_id,
                    name=state.name,
                    observed_seconds=duration_seconds,
                    waste_hours=round(waste_h, 4),
                    estimated_waste_kwh=round(room_waste_kwh, 4),
                    utilization_rate=round(utilization_rate, 2),
                    anomalies_detected=[a.model_dump() for a in state.anomalies],
                )
            )

        return DailySummary(
            period="day",
            generated_at=now,
            provenance={
                "mode": settings.run_mode,
                "storage": "in_memory",
                "is_mock_data": (settings.run_mode == "mock"),
            },
            observation_window=ObservationWindow(
                start_time=start_time,
                end_time=end_time,
                duration_seconds=round(duration_seconds, 1),
                coverage_ratio_24h=round(coverage_ratio, 4),
            ),
            completeness_status=completeness_status,
            data_quality_notes=notes,
            metrics=DailySummaryMetrics(
                total_waste_hours=round(total_waste_hours, 4),
                total_estimated_waste_kwh=round(total_estimated_waste_kwh, 4),
                rooms=room_metrics,
            ),
        )
