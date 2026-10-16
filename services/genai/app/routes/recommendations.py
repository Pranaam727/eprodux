"""
GET  /api/recommendations  — fetch recommendations for current twin state
POST /api/recommendations  — process a supplied TwinSummary (integration/test)

Sample GET request:
  curl http://localhost:8002/api/recommendations

Sample POST request:
  curl -X POST http://localhost:8002/api/recommendations \
    -H "Content-Type: application/json" \
    -d @fixtures/mock_summaries_payload.json

Sample response:
  {
    "recommendations": [
      {
        "id": "abc12345",
        "issue": "Lighting left on in unoccupied Seminar Hall",
        "location": "seminar_hall",
        "evidence": "Lighting is ON. Occupancy: 0 confirmed.",
        "action": "Switch off lighting in Seminar Hall immediately.",
        "priority": "high",
        "kWh_saved": 3.2,
        "cost_saved_inr": 25.6,
        "co2_saved_kg": 2.624,
        "confidence": "high",
        "data_mode": "fallback",
        "savings_assumptions": "Illustrative estimate..."
      }
    ],
    "data_mode": "fallback",
    "total_kwh_saved": 3.2,
    "total_cost_saved_inr": 25.6,
    "total_co2_saved_kg": 2.624,
    "warnings": []
  }
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Body, HTTPException

from adapters.twin_adapter import get_twin_adapter
from recommendations.generator import generate_recommendations
from recommendations.savings import aggregate_savings, SavingsResult
from schemas.recommendation import DataMode, Recommendation, RecommendationResponse
from schemas.twin_summary import TwinSummary

router = APIRouter(prefix="/api", tags=["Recommendations"])
logger = logging.getLogger(__name__)


def _compute_totals(recs: list[Recommendation]) -> tuple[Optional[float], Optional[float], Optional[float]]:
    """Aggregate deterministic savings across all recommendations."""
    from recommendations.savings import SavingsResult
    results = [
        SavingsResult(
            kwh_saved=r.kWh_saved,
            cost_saved_inr=r.cost_saved_inr,
            co2_saved_kg=r.co2_saved_kg,
            assumptions_text="",
        )
        for r in recs
    ]
    if not results:
        return None, None, None
    agg = aggregate_savings(results)
    return agg.kwh_saved, agg.cost_saved_inr, agg.co2_saved_kg


def _determine_mode(recs: list[Recommendation]) -> DataMode:
    if not recs:
        return DataMode.FALLBACK
    modes = {r.data_mode for r in recs}
    if DataMode.LIVE in modes:
        return DataMode.LIVE
    if DataMode.MOCK in modes:
        return DataMode.MOCK
    return DataMode.FALLBACK


@router.get("/recommendations", response_model=RecommendationResponse)
async def get_recommendations() -> RecommendationResponse:
    """
    Generate energy-efficiency recommendations based on current twin state.

    Fetches the twin summary via the configured adapter (mock in demo mode,
    HTTP in production), generates recommendations, and returns a validated
    JSON response with deterministic savings estimates.
    """
    try:
        adapter = get_twin_adapter()
        summary: TwinSummary = await adapter.fetch_summary()
    except Exception as e:
        logger.error("Failed to fetch twin summary: %s", e)
        raise HTTPException(status_code=503, detail=f"Twin backend unavailable: {e}")

    try:
        recs = generate_recommendations(summary)
    except Exception as e:
        logger.error("Recommendation generation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Recommendation generation error: {e}")

    kwh, cost, co2 = _compute_totals(recs)
    mode = _determine_mode(recs)

    warnings = list(summary.missing_data_warnings)
    if summary.data_freshness_minutes and summary.data_freshness_minutes > 60:
        warnings.append(f"Twin data is {summary.data_freshness_minutes:.0f} minutes old — refresh recommended.")

    return RecommendationResponse(
        recommendations=recs,
        data_mode=mode,
        total_kwh_saved=kwh,
        total_cost_saved_inr=cost,
        total_co2_saved_kg=co2,
        warnings=warnings,
    )


@router.post("/recommendations", response_model=RecommendationResponse)
async def post_recommendations(
    summary: TwinSummary = Body(..., description="Twin summary supplied directly by the caller."),
) -> RecommendationResponse:
    """
    Process a caller-supplied TwinSummary and return recommendations.

    Used for testing, direct integration, and bypassing the twin adapter.
    The summary must match the TwinSummary schema exactly.
    """
    try:
        recs = generate_recommendations(summary)
    except Exception as e:
        logger.error("Recommendation generation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Recommendation generation error: {e}")

    kwh, cost, co2 = _compute_totals(recs)
    mode = _determine_mode(recs)

    return RecommendationResponse(
        recommendations=recs,
        data_mode=mode,
        total_kwh_saved=kwh,
        total_cost_saved_inr=cost,
        total_co2_saved_kg=co2,
        warnings=list(summary.missing_data_warnings),
    )
