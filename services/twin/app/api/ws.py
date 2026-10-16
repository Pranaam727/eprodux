"""
WebSocket Connection Manager and Endpoint for live Digital Twin state.
"""
import asyncio
import json
import logging
from typing import List, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.models.schemas import BuildingStateSnapshot

logger = logging.getLogger(__name__)

router = APIRouter()


class WebSocketManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total active: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total active: {len(self.active_connections)}")

    async def broadcast_state(self, snapshot: BuildingStateSnapshot) -> None:
        if not self.active_connections:
            return

        payload_str = json.dumps(snapshot.model_dump(mode="json"))
        disconnected: List[WebSocket] = []

        async with self._lock:
            for connection in list(self.active_connections):
                try:
                    await connection.send_text(payload_str)
                except (WebSocketDisconnect, RuntimeError, Exception) as err:
                    logger.debug(f"Failed to send to client, marking for cleanup: {err}")
                    disconnected.append(connection)

            for conn in disconnected:
                self.active_connections.discard(conn)


ws_manager = WebSocketManager()


def notify_state_change_sync(snapshot: BuildingStateSnapshot) -> None:
    """Helper called by synchronous service events to schedule async broadcast on running loop."""
    try:
        loop = asyncio.get_running_loop()
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(ws_manager.broadcast_state(snapshot), loop)
    except RuntimeError:
        # Loop not running or in synchronous testing context; ignore safely
        pass
