"""
Tests for CV occupancy events and video analysis API endpoints.
Validates:
- GET /api/events/cv ordering, room filtering, and empty state
- POST /api/video/analyze execution, twin state update, and distinction
  between currentOccupancy, detectionCount, and uniqueTrackedPeople
- GET /api/video/status/{job_id} retrieval and 404 behavior
"""
from datetime import datetime, timedelta, timezone
from io import BytesIO
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_cv_events_empty_or_sorted():
    """Verify GET /api/events/cv returns valid list and handles filtering."""
    # Test unknown room returns 422
    res_bad = client.get("/api/events/cv?room_id=nonexistent_room")
    assert res_bad.status_code == 422

    # Ingest two events in order
    now = datetime.now(timezone.utc)
    t1 = now + timedelta(seconds=10)
    t2 = now + timedelta(seconds=20)

    # Ingest t1 first
    res1 = client.post(
        "/api/events/cv",
        json={
            "event_id": "test-cv-sort-1",
            "zone_id": "office",
            "timestamp": t1.isoformat(),
            "occupancy": 1,
            "confidence": 0.90,
            "source": "recorded-video",
        },
    )
    assert res1.status_code == 200

    # Ingest t2 second
    res2 = client.post(
        "/api/events/cv",
        json={
            "event_id": "test-cv-sort-2",
            "zone_id": "office",
            "timestamp": t2.isoformat(),
            "occupancy": 3,
            "confidence": 0.92,
            "source": "recorded-video",
        },
    )
    assert res2.status_code == 200

    # Retrieve events for office
    res = client.get("/api/events/cv?room_id=office")
    assert res.status_code == 200
    events = res.json()
    assert len(events) >= 2

    # Verify chronological ordering
    ts_list = [datetime.fromisoformat(e["timestamp"]) for e in events]
    assert ts_list == sorted(ts_list)


def test_post_video_analyze_and_status():
    """Verify POST /api/video/analyze processes video and distinguishes occupancy metrics."""
    fake_video_content = b"\x00\x00\x00 ftypmp42\x00\x00\x00\x00mp41isom"
    files = {"file": ("classroom_test.mp4", BytesIO(fake_video_content), "video/mp4")}
    data = {"target_room_id": "classroom"}

    response = client.post("/api/video/analyze", files=files, data=data)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["status"] == "completed"
    assert "job_id" in res_json
    job_id = res_json["job_id"]

    result = res_json["result"]
    assert result["isDemo"] is False
    assert result["fileName"] == "classroom_test.mp4"
    assert "observations" in result
    assert "classroom" in result["observations"]

    classroom_obs = result["observations"]["classroom"]
    assert classroom_obs["roomId"] == "classroom"
    assert "currentOccupancy" in classroom_obs
    assert "detectionCount" in classroom_obs
    assert "uniqueTrackedPeople" in classroom_obs
    assert classroom_obs["currentOccupancy"] is not None
    assert classroom_obs["uniqueTrackedPeople"] >= classroom_obs["currentOccupancy"]

    # Verify timeline is strictly chronological
    timeline = result["timeline"]
    assert len(timeline) > 0
    timestamps = [e["timestampSeconds"] for e in timeline]
    assert timestamps == sorted(timestamps)

    # Verify distinction in timeline events
    for evt in timeline:
        assert "currentOccupancy" in evt
        assert "detectionCount" in evt
        assert "uniqueTrackedPeople" in evt
        assert "confidence" in evt
        assert 0.0 <= evt["confidence"] <= 1.0

    # Test GET /api/video/status/{job_id}
    status_res = client.get(f"/api/video/status/{job_id}")
    assert status_res.status_code == 200
    assert status_res.json()["job_id"] == job_id

    # Test 404 for missing job
    missing_res = client.get("/api/video/status/cv-job-doesnotexist")
    assert missing_res.status_code == 404
