"""
POST /api/chat — grounded chat with building energy context.

Sample request:
  curl -X POST http://localhost:8002/api/chat \
    -H "Content-Type: application/json" \
    -d '{"question": "Which rooms are wasting energy right now?"}'

Sample response:
  {
    "answer": "Based on the available building data...",
    "evidence": ["seminar_hall: lighting ON, occupancy 0 (confirmed)"],
    "sources": [],
    "data_mode": "fallback",
    "grounded": true,
    "no_source_note": "No relevant guideline source was retrieved..."
  }
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from adapters.twin_adapter import get_twin_adapter
from chat.handler import handle_chat
from schemas.chat import ChatRequest, ChatResponse
from schemas.twin_summary import TwinSummary

router = APIRouter(prefix="/api", tags=["Chat"])
logger = logging.getLogger(__name__)


@router.post("/chat", response_model=ChatResponse)
async def post_chat(request: ChatRequest) -> ChatResponse:
    """
    Answer a natural-language question about building energy grounded in twin data.

    - Fetches the current twin summary via adapter (mock in demo mode).
    - Retrieves relevant guideline passages (RAG).
    - Calls Claude API when available; falls back to deterministic response.
    - Never fabricates sensor readings or guideline citations.
    """
    # Fetch twin summary
    try:
        if request.context:
            # Caller supplied context directly — parse it
            summary: TwinSummary = TwinSummary.model_validate(request.context)
        else:
            adapter = get_twin_adapter()
            summary = await adapter.fetch_summary()
    except Exception as e:
        logger.error("Chat: failed to obtain twin summary: %s", e)
        raise HTTPException(status_code=503, detail=f"Twin data unavailable: {e}")

    try:
        response = await handle_chat(request, summary)
    except Exception as e:
        logger.error("Chat handler error: %s", e)
        raise HTTPException(status_code=500, detail=f"Chat generation error: {e}")

    return response
