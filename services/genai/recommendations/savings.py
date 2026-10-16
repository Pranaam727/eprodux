"""
Deterministic savings calculations.

All numeric savings estimates are computed here — NOT by the LLM.
Any savings values provided by the LLM are DISCARDED and replaced by these functions.

Formulas (all illustrative estimates, not guaranteed real-world savings):
    kWh_saved      = power_kW × avoidable_hours × savings_fraction
    cost_saved_inr = kWh_saved × tariff_inr_per_kwh
    co2_saved_kg   = kWh_saved × emissions_factor_kg_per_kwh

Units:
    power_kW                  — kilowatts
    avoidable_hours           — hours per period
    savings_fraction          — dimensionless [0, 1]
    kWh_saved                 — kilowatt-hours
    cost_saved_inr            — Indian Rupees (INR)
    co2_saved_kg              — kilograms of CO2 equivalent
    tariff_inr_per_kwh        — INR per kWh
    emissions_factor_kg/kWh   — kg CO2 per kWh

Missing-input behaviour:
    If any required input is None or negative, the function returns None for
    that field. The caller must document the missing input rather than
    extrapolating a value.

Rounding:
    All returned values are rounded to 3 decimal places.
    Final display rounding (e.g., 2 d.p.) is the frontend's responsibility.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from core.settings import get_settings


@dataclass
class SavingsResult:
    """
    Deterministic savings estimate for a single opportunity.

    All values may be None when required inputs are absent.
    assumptions_text documents the parameters used so the estimate is auditable.
    """
    kwh_saved: Optional[float]
    cost_saved_inr: Optional[float]
    co2_saved_kg: Optional[float]
    assumptions_text: str


def calculate_savings(
    power_kw: Optional[float],
    avoidable_hours: Optional[float],
    savings_fraction: float = 1.0,
    tariff_inr_per_kwh: Optional[float] = None,
    emissions_factor_kg_per_kwh: Optional[float] = None,
) -> SavingsResult:
    """
    Compute energy, cost, and CO2 savings deterministically.

    Parameters
    ----------
    power_kw : float | None
        Device power in kW. Pass None if unknown.
    avoidable_hours : float | None
        Hours the device ran while it could have been switched off.
        Pass None if occupancy/waste data is unavailable.
    savings_fraction : float
        Fraction of avoidable hours that can realistically be saved.
        Default 1.0 (100 %). Reduce if partial saving is expected.
    tariff_inr_per_kwh : float | None
        Override the settings default tariff.
    emissions_factor_kg_per_kwh : float | None
        Override the settings default emissions factor.

    Returns
    -------
    SavingsResult with None fields where inputs were insufficient.
    """
    settings = get_settings()

    tariff = tariff_inr_per_kwh if tariff_inr_per_kwh is not None else settings.tariff_inr_per_kwh
    ef = emissions_factor_kg_per_kwh if emissions_factor_kg_per_kwh is not None else settings.emissions_factor_kg_per_kwh

    # Build human-readable assumption string regardless of whether we can calculate
    assumptions_parts = [
        f"power={power_kw} kW" if power_kw is not None else "power=unknown",
        f"avoidable_hours={avoidable_hours} h" if avoidable_hours is not None else "avoidable_hours=unknown",
        f"savings_fraction={savings_fraction}",
        f"tariff=₹{tariff}/kWh",
        f"emissions_factor={ef} kg CO2/kWh",
    ]
    assumptions_text = (
        "Illustrative estimate. Assumptions: "
        + ", ".join(assumptions_parts)
        + ". Not a measured or guaranteed saving."
    )

    # Guard: cannot calculate without power and hours
    if power_kw is None or power_kw < 0:
        return SavingsResult(None, None, None, assumptions_text)
    if avoidable_hours is None or avoidable_hours < 0:
        return SavingsResult(None, None, None, assumptions_text)
    if savings_fraction < 0 or savings_fraction > 1:
        savings_fraction = max(0.0, min(1.0, savings_fraction))

    kwh = round(power_kw * avoidable_hours * savings_fraction, 3)
    cost = round(kwh * tariff, 3)
    co2 = round(kwh * ef, 3)

    return SavingsResult(
        kwh_saved=kwh,
        cost_saved_inr=cost,
        co2_saved_kg=co2,
        assumptions_text=assumptions_text,
    )


def aggregate_savings(results: list[SavingsResult]) -> SavingsResult:
    """
    Sum multiple SavingsResult instances.
    Returns None for a field if ANY contributing result has that field as None
    — avoids double-counting partial estimates.

    Note: This sums across distinct opportunities. Do NOT aggregate overlapping
    opportunities (e.g., lighting AND HVAC for the same room-period) without
    verifying they are independent.
    """
    kwh_total: Optional[float] = 0.0
    cost_total: Optional[float] = 0.0
    co2_total: Optional[float] = 0.0

    for r in results:
        if r.kwh_saved is None:
            kwh_total = None
        elif kwh_total is not None:
            kwh_total = round(kwh_total + r.kwh_saved, 3)

        if r.cost_saved_inr is None:
            cost_total = None
        elif cost_total is not None:
            cost_total = round(cost_total + r.cost_saved_inr, 3)

        if r.co2_saved_kg is None:
            co2_total = None
        elif co2_total is not None:
            co2_total = round(co2_total + r.co2_saved_kg, 3)

    return SavingsResult(
        kwh_saved=kwh_total,
        cost_saved_inr=cost_total,
        co2_saved_kg=co2_total,
        assumptions_text="Aggregate of individual room estimates.",
    )
