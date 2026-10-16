"""
Pre-computed demo responses for offline / demo mode.

These are returned verbatim when DEMO_MODE=true and the LLM is unavailable.
They are NOT fabricated LLM outputs — they are deterministically constructed
from the mock summaries using the fallback engine, cached here for speed.

Label: data_mode = DataMode.FALLBACK in all pre-computed responses.
"""

from __future__ import annotations

from schemas.recommendation import (
    ConfidenceLevel,
    DataMode,
    Priority,
    Recommendation,
    RecommendationResponse,
)
from schemas.chat import ChatResponse

# ---------------------------------------------------------------------------
# Pre-computed recommendations for Scenario 1 (empty room lights on)
# ---------------------------------------------------------------------------
DEMO_RECS_EMPTY_ROOM: RecommendationResponse = RecommendationResponse(
    recommendations=[
        Recommendation(
            id="demo-001",
            issue="Lighting left on in unoccupied Seminar Hall",
            location="seminar_hall",
            evidence=(
                "Lighting is ON (source: simulated). "
                "Occupancy: 0 confirmed (source: simulated). "
                "Waste hours: 2.0 h."
            ),
            action="Switch off lighting in Seminar Hall immediately.",
            priority=Priority.HIGH,
            kWh_saved=3.2,
            cost_saved_inr=25.6,
            co2_saved_kg=2.624,
            confidence=ConfidenceLevel.HIGH,
            data_mode=DataMode.FALLBACK,
            savings_assumptions=(
                "Illustrative estimate. Assumptions: power=2.0 kW, "
                "avoidable_hours=2.0 h, savings_fraction=0.8, "
                "tariff=₹8.0/kWh, emissions_factor=0.82 kg CO2/kWh. "
                "Not a measured or guaranteed saving."
            ),
        ),
    ],
    data_mode=DataMode.FALLBACK,
    total_kwh_saved=3.2,
    total_cost_saved_inr=25.6,
    total_co2_saved_kg=2.624,
    warnings=["All values are from simulated data — not real sensor readings."],
)

# ---------------------------------------------------------------------------
# Pre-computed chat demo response
# ---------------------------------------------------------------------------
DEMO_CHAT_RESPONSE: ChatResponse = ChatResponse(
    answer=(
        "Based on the available building data (simulated demo mode), "
        "the Seminar Hall currently has lighting switched on with zero confirmed occupants. "
        "This represents an avoidable energy waste of approximately 3.2 kWh over 2 hours, "
        "equivalent to ₹25.60 and 2.6 kg CO₂. "
        "The Classroom, Lab, and Office all have lighting off and show normal consumption. "
        "Note: all values are illustrative estimates from simulated data."
    ),
    evidence=[
        "Seminar Hall: lighting ON, occupancy 0 (confirmed), waste_hours=2.0",
        "Classroom: lighting OFF, occupancy 0",
        "Lab: lighting OFF, occupancy 0",
        "Office: lighting OFF, occupancy 0",
    ],
    sources=[],
    data_mode=DataMode.FALLBACK,
    grounded=True,
    no_source_note=(
        "No external guideline source was retrieved for this response. "
        "Figures are based on the supplied twin summary only."
    ),
)
