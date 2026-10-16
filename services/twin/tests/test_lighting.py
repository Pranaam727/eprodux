from datetime import datetime, timezone


def test_lighting_update_manual_state(client):
    now = datetime.now(timezone.utc)
    payload = {
        "room_id": "lab",
        "timestamp": now.isoformat(),
        "light_state": "on",
        "source": "manual",
    }
    resp = client.put("/api/rooms/lab/lighting", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "accepted"
    assert data["room_id"] == "lab"
    assert data["light_state"] == "on"
    assert data["source"] == "manual"

    # Verify state reflection
    state_resp = client.get("/api/state")
    lab = next(r for r in state_resp.json()["rooms"] if r["room_id"] == "lab")
    assert lab["light_state"] == "on"
    assert lab["light_source"] == "manual"
    assert lab["provenance"]["lighting"] == "manual"
    # Rated power for lab is 800W
    assert lab["energy_data"]["estimated_current_power_w"] == 800.0


def test_lighting_mismatch_and_unknown_room(client):
    now = datetime.now(timezone.utc)

    # Unknown room ID in path (with valid body room) returns 404
    resp_404 = client.put(
        "/api/rooms/non_existent_room/lighting",
        json={
            "room_id": "classroom",
            "timestamp": now.isoformat(),
            "light_state": "on",
            "source": "manual",
        },
    )
    assert resp_404.status_code == 404

    # Mismatch between path and body returns 400
    resp_400 = client.put(
        "/api/rooms/classroom/lighting",
        json={
            "room_id": "office",
            "timestamp": now.isoformat(),
            "light_state": "off",
            "source": "manual",
        },
    )
    assert resp_400.status_code == 400

    # Unknown room ID in body returns 422 Unprocessable Entity
    resp_422 = client.put(
        "/api/rooms/classroom/lighting",
        json={
            "room_id": "invalid_zone",
            "timestamp": now.isoformat(),
            "light_state": "off",
            "source": "manual",
        },
    )
    assert resp_422.status_code == 422
