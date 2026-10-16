"""
FastAPI HTTP Routes for Eprodux Digital Twin.
"""
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from app.api.ws import notify_state_change_sync, ws_manager
from app.config import settings
from app.models.schemas import (
    CANONICAL_ROOM_IDS,
    BuildingStateSnapshot,
    CameraHealthInput,
    DailySummary,
    HealthResponse,
    LightingInput,
    OccupancyEvent,
)
from app.repositories.memory import InMemoryTwinRepository
from app.services.twin_service import TwinService

router = APIRouter()

# Global default in-memory repository and service singleton for Checkpoint 1
_default_repo = InMemoryTwinRepository()
_default_service = TwinService(
    repository=_default_repo,
    on_state_change_callback=notify_state_change_sync,
)


def get_twin_service() -> TwinService:
    return _default_service


@router.get("/healthz", response_model=HealthResponse, tags=["Health"])
def get_health() -> HealthResponse:
    """Service liveness and readiness probe."""
    return HealthResponse(
        status="healthy",
        service=settings.app_name,
        version=settings.version,
        run_mode=settings.run_mode,
        storage="in_memory",
    )


@router.get("/api/state", response_model=BuildingStateSnapshot, tags=["Digital Twin State"])
def get_building_state(
    service: TwinService = Depends(get_twin_service),
) -> BuildingStateSnapshot:
    """Return the current validated digital twin state snapshot across all 4 canonical rooms."""
    return service.get_building_snapshot()


@router.get("/api/summary", response_model=DailySummary, tags=["Analytics & Summary"])
def get_summary(
    period: str = Query("day", pattern="^day$", description="Aggregate period (day)"),
    service: TwinService = Depends(get_twin_service),
) -> DailySummary:
    """
    Return daily summary derived from available state and history.
    Exposes observation window, coverage, and mock flags.
    """
    return service.get_daily_summary(period=period)


@router.post("/api/events/cv", tags=["Event Ingestion"])
def ingest_cv_occupancy_event(
    event: OccupancyEvent,
    service: TwinService = Depends(get_twin_service),
) -> Dict[str, Any]:
    """
    Validated CV occupancy event ingestion adapter.
    Note: Lighting is decoupled and not accepted here.
    """
    if event.zone_id not in CANONICAL_ROOM_IDS:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown room identifier: {event.zone_id}. Expected one of {list(CANONICAL_ROOM_IDS)}",
        )
    try:
        return service.handle_occupancy_event(event)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.post("/api/events/camera-health", tags=["Event Ingestion"])
def ingest_camera_health_event(
    health_data: CameraHealthInput,
    service: TwinService = Depends(get_twin_service),
) -> Dict[str, Any]:
    """Accept camera health heartbeat or offline signal."""
    if health_data.room_id not in CANONICAL_ROOM_IDS:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown room identifier: {health_data.room_id}. Expected one of {list(CANONICAL_ROOM_IDS)}",
        )
    try:
        return service.handle_camera_health(health_data)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.put("/api/rooms/{room_id}/lighting", tags=["Lighting"])
def update_room_lighting(
    room_id: str,
    lighting_data: LightingInput,
    service: TwinService = Depends(get_twin_service),
) -> Dict[str, Any]:
    """
    Update manual or simulated lighting state in the digital twin.
    Does not issue direct physical equipment control commands.
    """
    if room_id not in CANONICAL_ROOM_IDS:
        raise HTTPException(
            status_code=404,
            detail=f"Room '{room_id}' not found in building model.",
        )
    if lighting_data.room_id != room_id:
        raise HTTPException(
            status_code=400,
            detail=f"Path room_id '{room_id}' does not match payload room_id '{lighting_data.room_id}'.",
        )
    try:
        return service.handle_lighting_input(lighting_data)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.websocket("/ws/state")
async def websocket_state_stream(
    websocket: WebSocket,
    service: TwinService = Depends(get_twin_service),
) -> None:
    """
    WebSocket endpoint for real-time digital twin state updates.
    Sends immediate snapshot on connection and streams on state transitions.
    """
    await ws_manager.connect(websocket)
    try:
        # Send initial snapshot immediately upon connect
        snapshot = service.get_building_snapshot()
        await websocket.send_json(snapshot.model_dump(mode="json"))
        # Keep connection alive listening for ping/disconnect
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception:
        await ws_manager.disconnect(websocket)
