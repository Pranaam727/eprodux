from datetime import datetime, timezone, timedelta
from app.models.schemas import (
    CameraHealthInput,
    LightingInput,
    OccupancyEvent,
    RoomProvenance,
    RoomState,
)


def test_idle_lit_alert_when_all_conditions_hold(fresh_service):
    now = datetime.now(timezone.utc)
    # Configure Seminar Hall: known 0 occupants, online camera, fresh event 10s ago, lights on, vacancy 200s (threshold=120s)
    state = RoomState(
        room_id="seminar_hall",
        name="Seminar Hall",
        occupancy=0,
        occupancy_status="known",
        confidence=0.95,
        light_state="on",
        light_source="manual",
        camera_status="online",
        last_event_at=now - timedelta(seconds=10),
        vacancy_seconds=200.0,
        environmental_data=None,
        energy_data=None,
        provenance=RoomProvenance(
            occupancy="recorded-video",
            lighting="manual",
            camera_health="heartbeat",
            environment="simulated",
            energy="simulated",
        ),
        anomalies=[],
    )
    anomalies = fresh_service.evaluate_room_anomalies(state, now)
    assert len(anomalies) == 1
    alert = anomalies[0]
    assert alert.rule_id == "sustained_idle_lit"
    assert alert.severity == "warning"
    assert alert.evidence["room_id"] == "seminar_hall"
    assert alert.evidence["vacancy_seconds"] == 200.0


def test_no_alert_when_people_present(fresh_service):
    now = datetime.now(timezone.utc)
    state = RoomState(
        room_id="seminar_hall",
        name="Seminar Hall",
        occupancy=1,  # Occupied!
        occupancy_status="known",
        confidence=0.95,
        light_state="on",
        light_source="manual",
        camera_status="online",
        last_event_at=now - timedelta(seconds=10),
        vacancy_seconds=None,
        environmental_data=None,
        energy_data=None,
        provenance=RoomProvenance(
            occupancy="recorded-video",
            lighting="manual",
            camera_health="heartbeat",
            environment="simulated",
            energy="simulated",
        ),
        anomalies=[],
    )
    anomalies = fresh_service.evaluate_room_anomalies(state, now)
    assert len(anomalies) == 0


def test_no_alert_when_occupancy_unknown_or_camera_offline(fresh_service):
    now = datetime.now(timezone.utc)

    # 1. Camera offline
    state_offline = RoomState(
        room_id="seminar_hall",
        name="Seminar Hall",
        occupancy=None,
        occupancy_status="unknown",
        confidence=None,
        light_state="on",
        light_source="manual",
        camera_status="offline",
        last_event_at=now - timedelta(seconds=10),
        vacancy_seconds=None,
        environmental_data=None,
        energy_data=None,
        provenance=RoomProvenance(
            occupancy="recorded-video",
            lighting="manual",
            camera_health="heartbeat",
            environment="simulated",
            energy="simulated",
        ),
        anomalies=[],
    )
    assert len(fresh_service.evaluate_room_anomalies(state_offline, now)) == 0

    # 2. Camera online but occupancy unknown
    state_unknown = state_offline.model_copy()
    state_unknown.camera_status = "online"
    assert len(fresh_service.evaluate_room_anomalies(state_unknown, now)) == 0


def test_no_alert_when_lights_off_or_vacancy_below_threshold(fresh_service):
    now = datetime.now(timezone.utc)

    # Lights OFF
    state_lights_off = RoomState(
        room_id="seminar_hall",
        name="Seminar Hall",
        occupancy=0,
        occupancy_status="known",
        confidence=0.95,
        light_state="off",
        light_source="manual",
        camera_status="online",
        last_event_at=now - timedelta(seconds=10),
        vacancy_seconds=300.0,
        environmental_data=None,
        energy_data=None,
        provenance=RoomProvenance(
            occupancy="recorded-video",
            lighting="manual",
            camera_health="heartbeat",
            environment="simulated",
            energy="simulated",
        ),
        anomalies=[],
    )
    assert len(fresh_service.evaluate_room_anomalies(state_lights_off, now)) == 0

    # Vacancy below threshold (60s < 120s)
    state_low_vacancy = state_lights_off.model_copy()
    state_low_vacancy.light_state = "on"
    state_low_vacancy.vacancy_seconds = 60.0
    assert len(fresh_service.evaluate_room_anomalies(state_low_vacancy, now)) == 0


def test_no_alert_when_confidence_insufficient(fresh_service):
    now = datetime.now(timezone.utc)
    state_low_conf = RoomState(
        room_id="seminar_hall",
        name="Seminar Hall",
        occupancy=0,
        occupancy_status="known",
        confidence=0.50,  # Below min_confidence_threshold (0.70)
        light_state="on",
        light_source="manual",
        camera_status="online",
        last_event_at=now - timedelta(seconds=10),
        vacancy_seconds=300.0,
        environmental_data=None,
        energy_data=None,
        provenance=RoomProvenance(
            occupancy="recorded-video",
            lighting="manual",
            camera_health="heartbeat",
            environment="simulated",
            energy="simulated",
        ),
        anomalies=[],
    )
    assert len(fresh_service.evaluate_room_anomalies(state_low_conf, now)) == 0
