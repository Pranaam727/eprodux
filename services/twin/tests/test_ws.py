import pytest
from app.api.ws import ws_manager


def test_websocket_initial_state_connection(client):
    with client.websocket_connect("/ws/state") as websocket:
        initial_data = websocket.receive_json()
        assert "building_id" in initial_data
        assert "floor_id" in initial_data
        assert "rooms" in initial_data
        assert len(initial_data["rooms"]) == 4

        # Verify canonical room identifiers in initial payload
        room_ids = [r["room_id"] for r in initial_data["rooms"]]
        assert "seminar_hall" in room_ids
        assert "classroom" in room_ids
        assert "lab" in room_ids
        assert "office" in room_ids


@pytest.mark.asyncio
async def test_websocket_broadcast(client):
    with client.websocket_connect("/ws/state") as websocket:
        # First read initial state
        initial_data = websocket.receive_json()
        assert initial_data is not None

        # Verify active connection is tracked in ws_manager
        assert len(ws_manager.active_connections) >= 1

    # After exiting with block, connection is closed cleanly
    assert len(ws_manager.active_connections) == 0
