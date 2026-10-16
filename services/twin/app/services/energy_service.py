"""
Energy calculation service foundation.
Arithmetic: energy_kwh = power_w * duration_hours / 1000
Requires explicit, validated input values. Never silently invents missing device wattages.
"""
from typing import Optional, Union


def calculate_energy_kwh(
    power_w: Union[int, float, None],
    duration_hours: Optional[Union[int, float]] = None,
    duration_seconds: Optional[Union[int, float]] = None,
) -> float:
    """
    Compute electrical energy consumption in kilowatt-hours (kWh).

    Args:
        power_w: Rated or observed power in watts (W). Must be non-null and >= 0.
        duration_hours: Operational duration in hours.
        duration_seconds: Operational duration in seconds (mutually inclusive alternative).

    Returns:
        float: Calculated energy in kWh.

    Raises:
        ValueError: If power_w is None, negative, non-numeric, or if duration is missing/invalid.
    """
    if power_w is None:
        raise ValueError("Cannot calculate energy: power_w is None (unknown power rating).")

    try:
        power_val = float(power_w)
    except (TypeError, ValueError) as err:
        raise ValueError(f"power_w must be numeric, got {power_w!r}") from err

    if power_val < 0:
        raise ValueError(f"power_w must be non-negative, got {power_val}")

    if duration_hours is None and duration_seconds is None:
        raise ValueError("Either duration_hours or duration_seconds must be provided.")

    if duration_hours is not None:
        try:
            hours_val = float(duration_hours)
        except (TypeError, ValueError) as err:
            raise ValueError(f"duration_hours must be numeric, got {duration_hours!r}") from err
        if hours_val < 0:
            raise ValueError(f"duration_hours must be non-negative, got {hours_val}")
    else:
        try:
            secs_val = float(duration_seconds)
        except (TypeError, ValueError) as err:
            raise ValueError(f"duration_seconds must be numeric, got {duration_seconds!r}") from err
        if secs_val < 0:
            raise ValueError(f"duration_seconds must be non-negative, got {secs_val}")
        hours_val = secs_val / 3600.0

    return (power_val * hours_val) / 1000.0


def estimate_lighting_waste_kwh(
    rated_power_w: Optional[float],
    waste_duration_seconds: float,
) -> Optional[float]:
    """
    Safely estimate waste energy for a lighting group.
    Returns None if rated_power_w is not established, rather than fabricating a value.
    """
    if rated_power_w is None:
        return None
    if waste_duration_seconds <= 0:
        return 0.0
    return calculate_energy_kwh(power_w=rated_power_w, duration_seconds=waste_duration_seconds)
