"""
Recommendation output schema.

All numeric savings fields (kWh_saved, cost_saved_inr, co2_saved_kg) are
computed by the deterministic savings module (recommendations/savings.py).
Any values provided by the LLM are DISCARDED and replaced server-side.

Units:
  kWh_saved      — kilowatt-hours
  cost_saved_inr — Indian Rupees (INR)
  co2_saved_kg   — kilograms of CO2 equivalent
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, computed_field, model_validator


class Priority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ConfidenceLevel(str, Enum):
    HIGH = "high"              # strong evidence, occupancy known, meter data present
    MEDIUM = "medium"          # partial evidence
    LOW = "low"                # inferred from limited data
    INSUFFICIENT_DATA = "insufficient_data"  # cannot make a grounded recommendation


class DataMode(str, Enum):
    LIVE = "live"              # real twin data + live LLM call
    MOCK = "mock"              # fixture/mock twin data
    FALLBACK = "fallback"      # rule-based fallback, no LLM


class GuidelineRef(BaseModel):
    """Citation for a retrieved sustainability guideline passage."""
    source_title: str = Field(description="Title of the source document.")
    organization: str = Field(description="Issuing organisation.")
    excerpt: str = Field(description="Relevant passage (verbatim from retrieved chunk).")
    filename_or_url: str = Field(description="Local filename or URL of the source.")


class Recommendation(BaseModel):
    """
    A single actionable energy-efficiency recommendation.

    Savings figures are illustrative estimates based on documented assumptions,
    NOT guaranteed real-world savings.
    """

    id: str = Field(description="Unique recommendation ID within a response.")
    issue: str = Field(description="Short description of the identified issue.")
    location: str = Field(description="Room ID where the issue was detected.")
    evidence: str = Field(
        description=(
            "Factual observations from the twin summary that support this recommendation. "
            "Must reference only supplied twin data — not invented measurements."
        )
    )
    action: str = Field(description="Recommended corrective action.")
    priority: Priority

    # Savings — set by deterministic Python calculations, never by the LLM.
    kWh_saved: Optional[float] = Field(
        default=None,
        ge=0.0,
        description=(
            "Estimated avoidable energy in kWh. "
            "None when required inputs (power, waste_hours) are unavailable."
        ),
    )
    cost_saved_inr: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Estimated cost saving in INR. None when kWh_saved is None.",
    )
    co2_saved_kg: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Estimated CO2 saving in kg. None when kWh_saved is None.",
    )

    guideline_ref: Optional[GuidelineRef] = Field(
        default=None,
        description=(
            "Citation for a retrieved sustainability guideline. "
            "Only present when a relevant passage was actually retrieved."
        ),
    )
    confidence: ConfidenceLevel = Field(
        default=ConfidenceLevel.MEDIUM,
        description="Evidence quality indicator.",
    )
    data_mode: DataMode = Field(
        default=DataMode.LIVE,
        description="Indicates whether live, mock, or fallback data was used.",
    )

    # Savings assumption documentation
    savings_assumptions: Optional[str] = Field(
        default=None,
        description=(
            "Human-readable description of the assumptions used in savings calculation, "
            "e.g., device power, hours, tariff, emissions factor."
        ),
    )

    @model_validator(mode="before")
    @classmethod
    def populate_savings_aliases(cls, data):
        if isinstance(data, dict):
            if "cost_saved" in data and "cost_saved_inr" not in data:
                data["cost_saved_inr"] = data["cost_saved"]
            if "co2_saved" in data and "co2_saved_kg" not in data:
                data["co2_saved_kg"] = data["co2_saved"]
        return data

    @computed_field
    @property
    def cost_saved(self) -> Optional[float]:
        """Estimated cost saving (INR). Provided for contract compatibility with cost_saved field."""
        return self.cost_saved_inr

    @computed_field
    @property
    def co2_saved(self) -> Optional[float]:
        """Estimated CO2 saving (kg). Provided for contract compatibility with co2_saved field."""
        return self.co2_saved_kg


class RecommendationResponse(BaseModel):
    """Top-level response for GET /api/recommendations."""
    recommendations: list[Recommendation]
    data_mode: DataMode
    total_kwh_saved: Optional[float] = None
    total_cost_saved_inr: Optional[float] = None
    total_co2_saved_kg: Optional[float] = None
    warnings: list[str] = Field(default_factory=list)

    @computed_field
    @property
    def total_cost_saved(self) -> Optional[float]:
        """Total cost saved (INR). Provided for contract compatibility."""
        return self.total_cost_saved_inr

    @computed_field
    @property
    def total_co2_saved(self) -> Optional[float]:
        """Total CO2 saved (kg). Provided for contract compatibility."""
        return self.total_co2_saved_kg
