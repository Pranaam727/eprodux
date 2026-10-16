from datetime import datetime, timezone, timedelta


def test_camera_offline_sets_occupancy_to_unknown(client):
    now = datetime.now(timezone.utc)
    # Classroom starts with known occupants
    health_payload = {
        "room_id": "classroom",
        "timestamp": now.isoformat(),
        "status": "offline",
        "source": "cv_monitor",
    }
    resp = client.post("/api/events/camera-health", json=health_payload)
    assert resp.status_code == 200
    assert resp.json()["camera_status"] == "offline"
    assert resp.json()["occupancy_status"] == "unknown"

    # Verify via GET /api/state
    state_resp = client.get("/api/state")
    cr = next(r for r in state_resp.json()["rooms"] if r["room_id"] == "classroom")
    assert cr["camera_status"] == "offline"
    assert cr["occupancy"] is None
    assert cr["occupancy_status"] == "unknown"


def test_stale_cv_events_cannot_leave_room_confidently_empty(client, fresh_service):
    now = datetime.now(timezone.utc)

    # Set office camera online but with last observation 45 seconds ago (stale threshold is 30s)
    office_state = fresh_service.repo.get_room_state("office")
    assert office_state is not None
    office_state.camera_status = "online"
    office_state.occupancy = 0
    office_state.occupancy_status = "known"
    office_state.confidence = 0.95
    office_state.last_event_at = now - timedelta(seconds=45)
    fresh_service.repo.save_room_state(office_state)

    # Query state at current time 'now' (45 seconds after event)
    # The twin snapshot logic evaluates staleness against 'now'
    state_resp = client.get("/api/state")
    assert state_resp.status_code == 200
    off = next(r for r in state_resp.json()["rooms"] if r["room_id"] == "office")

    # Due to age 45s > 30s stale threshold, camera is stale and occupancy is UNKNOWN (not 0!)
    assert off["camera_status"] == "stale"
    assert off["occupancy"] is None
    assert off["occupancy_status"] == "unknown"
    assert off["vacancy_seconds"] is None
    # No idle-lit anomaly can be raised on a stale feed
    assert len(off["anomalies"]) == 0
