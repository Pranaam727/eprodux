"""
Tests for deterministic savings calculations (recommendations/savings.py).

All tests are pure Python — no external calls, no API keys required.
"""

import pytest
from recommendations.savings import SavingsResult, aggregate_savings, calculate_savings


class TestCalculateSavings:
    def test_basic_calculation(self):
        """Correct kWh, cost, CO2 from known inputs."""
        result = calculate_savings(
            power_kw=2.0,
            avoidable_hours=2.0,
            savings_fraction=1.0,
            tariff_inr_per_kwh=8.0,
            emissions_factor_kg_per_kwh=0.82,
        )
        assert result.kwh_saved == pytest.approx(4.0, rel=1e-3)
        assert result.cost_saved_inr == pytest.approx(32.0, rel=1e-3)
        assert result.co2_saved_kg == pytest.approx(3.28, rel=1e-3)

    def test_savings_fraction_applied(self):
        """savings_fraction=0.8 reduces output by 20%."""
        result = calculate_savings(
            power_kw=2.0,
            avoidable_hours=2.0,
            savings_fraction=0.8,
            tariff_inr_per_kwh=8.0,
            emissions_factor_kg_per_kwh=0.82,
        )
        assert result.kwh_saved == pytest.approx(3.2, rel=1e-3)
        assert result.cost_saved_inr == pytest.approx(25.6, rel=1e-3)
        assert result.co2_saved_kg == pytest.approx(2.624, rel=1e-3)

    def test_missing_power_returns_none(self):
        """None power → all fields None."""
        result = calculate_savings(power_kw=None, avoidable_hours=2.0)
        assert result.kwh_saved is None
        assert result.cost_saved_inr is None
        assert result.co2_saved_kg is None

    def test_missing_hours_returns_none(self):
        """None avoidable_hours → all fields None."""
        result = calculate_savings(power_kw=1.5, avoidable_hours=None)
        assert result.kwh_saved is None
        assert result.cost_saved_inr is None
        assert result.co2_saved_kg is None

    def test_negative_power_returns_none(self):
        result = calculate_savings(power_kw=-1.0, avoidable_hours=3.0)
        assert result.kwh_saved is None

    def test_negative_hours_returns_none(self):
        result = calculate_savings(power_kw=1.0, avoidable_hours=-2.0)
        assert result.kwh_saved is None

    def test_zero_hours_returns_zero(self):
        """Zero avoidable hours → zero savings (not None)."""
        result = calculate_savings(power_kw=2.0, avoidable_hours=0.0)
        assert result.kwh_saved == 0.0
        assert result.cost_saved_inr == 0.0
        assert result.co2_saved_kg == 0.0

    def test_results_are_non_negative(self):
        result = calculate_savings(power_kw=1.0, avoidable_hours=1.0)
        assert result.kwh_saved >= 0
        assert result.cost_saved_inr >= 0
        assert result.co2_saved_kg >= 0

    def test_assumptions_text_populated(self):
        result = calculate_savings(power_kw=1.0, avoidable_hours=1.0)
        assert result.assumptions_text
        assert "Not a measured" in result.assumptions_text

    def test_assumptions_text_missing_inputs(self):
        """Assumptions text mentions 'unknown' when inputs are missing."""
        result = calculate_savings(power_kw=None, avoidable_hours=None)
        assert "unknown" in result.assumptions_text

    def test_rounding_to_three_decimal_places(self):
        result = calculate_savings(
            power_kw=1.333,
            avoidable_hours=3.0,
            savings_fraction=1.0,
            tariff_inr_per_kwh=8.0,
            emissions_factor_kg_per_kwh=0.82,
        )
        # Check rounded to 3 dp
        if result.kwh_saved is not None:
            assert result.kwh_saved == round(result.kwh_saved, 3)

    def test_savings_fraction_clamped(self):
        """savings_fraction > 1.0 is clamped to 1.0."""
        r_clamped = calculate_savings(power_kw=2.0, avoidable_hours=1.0, savings_fraction=1.5)
        r_max = calculate_savings(power_kw=2.0, avoidable_hours=1.0, savings_fraction=1.0)
        assert r_clamped.kwh_saved == r_max.kwh_saved

    def test_uses_settings_defaults(self):
        """Without override, uses tariff and factor from Settings."""
        from core.settings import get_settings
        s = get_settings()
        result = calculate_savings(power_kw=1.0, avoidable_hours=1.0)
        expected_kwh = 1.0
        expected_cost = round(expected_kwh * s.tariff_inr_per_kwh, 3)
        assert result.cost_saved_inr == pytest.approx(expected_cost, rel=1e-3)


class TestAggregateSavings:
    def test_aggregate_sums_correctly(self):
        r1 = SavingsResult(2.0, 16.0, 1.64, "")
        r2 = SavingsResult(1.0, 8.0, 0.82, "")
        agg = aggregate_savings([r1, r2])
        assert agg.kwh_saved == pytest.approx(3.0)
        assert agg.cost_saved_inr == pytest.approx(24.0)
        assert agg.co2_saved_kg == pytest.approx(2.46)

    def test_aggregate_none_propagates(self):
        """If any result has None, the aggregate field becomes None."""
        r1 = SavingsResult(2.0, 16.0, 1.64, "")
        r2 = SavingsResult(None, None, None, "")
        agg = aggregate_savings([r1, r2])
        assert agg.kwh_saved is None
        assert agg.cost_saved_inr is None

    def test_aggregate_empty_list(self):
        agg = aggregate_savings([])
        assert agg.kwh_saved == 0.0
