"""Chat request and response schemas."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from schemas.recommendation import DataMode, GuidelineRef


class ChatRequest(BaseModel):
    """
    POST /api/chat request body.

    The caller can optionally supply a twin summary context dict.
    When absent, the service fetches the current summary from the twin adapter.
    """
    question: str = Field(
        description="User's natural-language question about building energy or rooms.",
        min_length=1,
        max_length=2000,
    )
    context: Optional[dict] = Field(
        default=None,
        description=(
            "Optional pre-fetched twin summary as a plain dict. "
            "Used by the frontend to avoid a second backend round-trip."
        ),
    )


class ChatResponse(BaseModel):
    """POST /api/chat response body."""
    answer: str = Field(
        description=(
            "Grounded answer to the question. References only observations "
            "present in the twin summary or retrieved guideline passages."
        )
    )
    evidence: List[str] = Field(
        default_factory=list,
        description="Key facts from the twin summary used to ground the answer.",
    )
    sources: List[GuidelineRef] = Field(
        default_factory=list,
        description=(
            "Guideline passages retrieved to support the answer. "
            "Empty list when no relevant source was found."
        ),
    )
    data_mode: DataMode = Field(
        description="Indicates whether live, mock, or fallback data was used.",
    )
    grounded: bool = Field(
        description=(
            "True when the answer is grounded in supplied twin data. "
            "False in fallback mode or when the question cannot be answered "
            "from available evidence."
        )
    )
    no_source_note: Optional[str] = Field(
        default=None,
        description=(
            "Populated when no relevant guideline source was found, "
            "explaining that no citation is available."
        ),
    )
