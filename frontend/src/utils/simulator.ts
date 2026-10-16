// ============================================================
// Eprodux – What-If Simulator calculations
// All calculations are deterministic and performed in code.
// Assumptions are surfaced explicitly for display.
// ============================================================

import type { SimulatorInputs, SimulatorOutputs } from '../types';

/**
 * Default assumption values – clearly labeled in the UI.
 * Tariff and CO₂ factor are demonstration values based on
 * Indian average electricity pricing and grid emission factor.
 */
export const DEFAULT_SIMULATOR_INPUTS: SimulatorInputs = {
  selectedRooms: ['seminar_hall', 'classroom', 'lab', 'office'],
  avoidableLightingHours: 2,
  lightingPowerWattsPerRoom: 1000,  // 1 kW per room (assumption)
  tariffInrPerKwh: 8.0,             // ₹8/kWh – demonstration assumption
  co2KgPerKwh: 0.82,               // India grid average kg CO₂/kWh (CEA 2023)
  daysPerWeek: 5,
  weeksPerYear: 48,
};

/**
 * Compute simulator outputs from inputs.
 * Formula:
 *   dailyEnergy = rooms × hours × powerW / 1000
 *   cost = energy × tariff
 *   co2  = energy × co2Factor
 */
export function computeSimulation(inputs: SimulatorInputs): SimulatorOutputs {
  const roomCount = inputs.selectedRooms.length;
  const dailyEnergy =
    (roomCount * inputs.avoidableLightingHours * inputs.lightingPowerWattsPerRoom) / 1000;

  const weeklyEnergy = dailyEnergy * inputs.daysPerWeek;
  const annualEnergy = weeklyEnergy * inputs.weeksPerYear;

  const dailyCost = dailyEnergy * inputs.tariffInrPerKwh;
  const weeklyCost = weeklyEnergy * inputs.tariffInrPerKwh;
  const annualCost = annualEnergy * inputs.tariffInrPerKwh;

  const dailyCo2 = dailyEnergy * inputs.co2KgPerKwh;
  const weeklyCo2 = weeklyEnergy * inputs.co2KgPerKwh;
  const annualCo2 = annualEnergy * inputs.co2KgPerKwh;

  const assumptions: Record<string, string> = {
    'Rooms included': `${roomCount} (${inputs.selectedRooms.join(', ')})`,
    'Avoidable lighting hours/day': `${inputs.avoidableLightingHours} h`,
    'Lighting power per room': `${inputs.lightingPowerWattsPerRoom} W (demonstration assumption)`,
    'Electricity tariff': `₹${inputs.tariffInrPerKwh}/kWh (demonstration assumption)`,
    'CO₂ emission factor': `${inputs.co2KgPerKwh} kg/kWh (India grid avg, CEA 2023)`,
    'Policy days per week': `${inputs.daysPerWeek} days`,
    'Policy weeks per year': `${inputs.weeksPerYear} weeks`,
    'Model': 'Simple linear projection – not a physical simulation',
  };

  return {
    dailyEnergySavedKwh: round2(dailyEnergy),
    weeklyEnergySavedKwh: round2(weeklyEnergy),
    annualEnergySavedKwh: round2(annualEnergy),
    dailyCostSavedInr: round2(dailyCost),
    weeklyCostSavedInr: round2(weeklyCost),
    annualCostSavedInr: round2(annualCost),
    dailyCo2SavedKg: round2(dailyCo2),
    weeklyCo2SavedKg: round2(weeklyCo2),
    annualCo2SavedKg: round2(annualCo2),
    assumptions,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
