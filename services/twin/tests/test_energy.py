import pytest
from app.services.energy_service import (
    calculate_energy_kwh,
    estimate_lighting_waste_kwh,
)


def test_energy_calculation_valid_hours():
    # Note: Values are for arithmetic testing, not surveyed Eprodux measurements
    # 1000W for 2 hours = 2.0 kWh
    result = calculate_energy_kwh(power_w=1000.0, duration_hours=2.0)
    assert pytest.approx(result, 1e-4) == 2.0

    # 600W for 0.5 hours = 0.3 kWh
    result = calculate_energy_kwh(power_w=600.0, duration_hours=0.5)
    assert pytest.approx(result, 1e-4) == 0.3


def test_energy_calculation_valid_seconds():
    # 1200W for 3600 seconds (1 hour) = 1.2 kWh
    result = calculate_energy_kwh(power_w=1200.0, duration_seconds=3600.0)
    assert pytest.approx(result, 1e-4) == 1.2

    # 300W for 1800 seconds (0.5 hour) = 0.15 kWh
    result = calculate_energy_kwh(power_w=300.0, duration_seconds=1800.0)
    assert pytest.approx(result, 1e-4) == 0.15


def test_energy_calculation_invalid_power():
    # None power rating must raise ValueError (cannot fabricate power)
    with pytest.raises(ValueError, match="power_w is None"):
        calculate_energy_kwh(power_w=None, duration_hours=1.0)

    # Negative power must raise ValueError
    with pytest.raises(ValueError, match="non-negative"):
        calculate_energy_kwh(power_w=-50.0, duration_hours=1.0)

    # Non-numeric string
    with pytest.raises(ValueError, match="numeric"):
        calculate_energy_kwh(power_w="unknown", duration_hours=1.0)


def test_energy_calculation_invalid_duration():
    # Missing both durations
    with pytest.raises(ValueError, match="Either duration_hours or duration_seconds"):
        calculate_energy_kwh(power_w=500.0)

    # Negative hours
    with pytest.raises(ValueError, match="non-negative"):
        calculate_energy_kwh(power_w=500.0, duration_hours=-2.0)

    # Negative seconds
    with pytest.raises(ValueError, match="non-negative"):
        calculate_energy_kwh(power_w=500.0, duration_seconds=-100.0)


def test_estimate_lighting_waste_kwh_safety():
    # Unspecified power rating returns None instead of fabricating a default
    assert estimate_lighting_waste_kwh(rated_power_w=None, waste_duration_seconds=3600.0) is None

    # Zero waste duration returns 0.0 kWh
    assert estimate_lighting_waste_kwh(rated_power_w=600.0, waste_duration_seconds=0.0) == 0.0
    assert estimate_lighting_waste_kwh(rated_power_w=600.0, waste_duration_seconds=-10.0) == 0.0

    # Normal calculation
    waste = estimate_lighting_waste_kwh(rated_power_w=1200.0, waste_duration_seconds=1800.0)
    assert pytest.approx(waste, 1e-4) == 0.6
