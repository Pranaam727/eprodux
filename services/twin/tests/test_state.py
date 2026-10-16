from app.models.schemas import CANONICAL_ROOM_IDS


def test_state_endpoint_canonical_rooms(client):
    response = client.get("/api/state")
    assert response.status_code == 200
    data = response.json()

    assert "building_id" in data
    assert "floor_id" in data
    assert "updated_at" in data
    assert "run_mode" in data

    rooms = data["rooms"]
    assert len(rooms) == 4

    room_ids = [r["room_id"] for r in rooms]
    assert tuple(room_ids) == CANONICAL_ROOM_IDS


def test_state_provenance_and_mock_labels(client):
    response = client.get("/api/state")
    assert response.status_code == 200
    data = response.json()

    for room in data["rooms"]:
        prov = room["provenance"]
        assert "occupancy" in prov
        assert "lighting" in prov
        assert "camera_health" in prov
        assert "environment" in prov
        assert "energy" in prov

        if room["environmental_data"]:
            assert room["environmental_data"]["provenance"] == "simulated"

        if room["energy_data"]:
            assert room["energy_data"]["provenance"] in ("simulated", "calculated")
