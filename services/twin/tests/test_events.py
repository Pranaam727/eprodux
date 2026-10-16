from datetime import datetime, timezone, timedelta


def test_valid_cv_event_ingestion(client):
    now = datetime.now(timezone.utc)
    event_payload = {
        "event_id": "test_evt_001",
        "zone_id": "classroom",
        "timestamp": now.isoformat(),
        "occupancy": 8,
        "confidence": 0.95,
        "source": "recorded-video",
    }
    resp = client.post("/api/events/cv", json=event_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "accepted"
    assert data["deduplicated"] is False

    # Verify updated state snapshot
    state_resp = client.get("/api/state")
    assert state_resp.status_code == 200
    cr = next(r for r in state_resp.json()["rooms"] if r["room_id"] == "classroom")
    assert cr["occupancy"] == 8
    assert cr["occupancy_status"] == "known"
    assert cr["confidence"] == 0.95
    assert cr["provenance"]["occupancy"] == "recorded-video"


def test_invalid_cv_events_rejected(client):
    now = datetime.now(timezone.utc)

    # Negative occupancy
    resp = client.post(
        "/api/events/cv",
        json={
            "event_id": "bad_occ",
            "zone_id": "classroom",
            "timestamp": now.isoformat(),
            "occupancy": -5,
            "source": "mock",
        },
    )
    assert resp.status_code == 422

    # Confidence out of bounds
    resp = client.post(
        "/api/events/cv",
        json={
            "event_id": "bad_conf",
            "zone_id": "classroom",
            "timestamp": now.isoformat(),
            "occupancy": 5,
            "confidence": 1.5,
            "source": "mock",
        },
    )
    assert resp.status_code == 422


def test_unknown_room_id_rejected(client):
    now = datetime.now(timezone.utc)
    resp = client.post(
        "/api/events/cv",
        json={
            "event_id": "unknown_zone_evt",
            "zone_id": "auditorium_annex",
            "timestamp": now.isoformat(),
            "occupancy": 3,
            "source": "mock",
        },
    )
    assert resp.status_code == 422


def test_duplicate_event_deduplication(client):
    now = datetime.now(timezone.utc)
    event_payload = {
        "event_id": "duplicate_evt_123",
        "zone_id": "office",
        "timestamp": now.isoformat(),
        "occupancy": 4,
        "confidence": 0.85,
        "source": "recorded-video",
    }
    # First ingestion
    resp1 = client.post("/api/events/cv", json=event_payload)
    assert resp1.status_code == 200
    assert resp1.json()["deduplicated"] is False

    # Second ingestion with identical event_id
    resp2 = client.post("/api/events/cv", json=event_payload)
    assert resp2.status_code == 200
    assert resp2.json()["deduplicated"] is True


def test_older_out_of_order_event_ignored(client):
    now = datetime.now(timezone.utc)
    base_time = now - timedelta(seconds=5)
    older_time = now - timedelta(seconds=15)

    # Ingest newer event first
    newer_evt = {
        "event_id": "newer_evt",
        "zone_id": "seminar_hall",
        "timestamp": base_time.isoformat(),
        "occupancy": 10,
        "confidence": 0.9,
        "source": "recorded-video",
    }
    resp1 = client.post("/api/events/cv", json=newer_evt)
    assert resp1.status_code == 200

    # Ingest older event with different count
    older_evt = {
        "event_id": "older_evt",
        "zone_id": "seminar_hall",
        "timestamp": older_time.isoformat(),
        "occupancy": 2,
        "confidence": 0.8,
        "source": "recorded-video",
    }
    resp2 = client.post("/api/events/cv", json=older_evt)
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "ignored"

    # Verify state retained the newer count (10), not 2
    state_resp = client.get("/api/state")
    sh = next(r for r in state_resp.json()["rooms"] if r["room_id"] == "seminar_hall")
    assert sh["occupancy"] == 10
