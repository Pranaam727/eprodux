// ============================================================
// WhatIfSimulator – energy-saving policy exploration
// Uses deterministic calculations – no LLM arithmetic.
// ============================================================

import { useState } from 'react';
import type { SimulatorInputs } from '../types';
import type { RoomId } from '../types';
import { computeSimulation, DEFAULT_SIMULATOR_INPUTS } from '../utils/simulator';
import { ROOM_METADATA } from '../services/mockData';

const ALL_ROOM_IDS: RoomId[] = ['seminar_hall', 'classroom', 'lab', 'office'];

export function WhatIfSimulator() {
  const [inputs, setInputs] = useState<SimulatorInputs>(DEFAULT_SIMULATOR_INPUTS);
  const outputs = computeSimulation(inputs);

  const [showAssumptions, setShowAssumptions] = useState(false);

  function toggleRoom(id: RoomId) {
    setInputs(prev => ({
      ...prev,
      selectedRooms: prev.selectedRooms.includes(id)
        ? prev.selectedRooms.filter(r => r !== id)
        : [...prev.selectedRooms, id],
    }));
  }

  function setField<K extends keyof SimulatorInputs>(key: K, value: SimulatorInputs[K]) {
    setInputs(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div role="region" aria-label="What-If Energy Simulator">
      <div className="section-header mb-4">
        <span className="section-title">⚡ What-If Energy Simulator</span>
        <span className="badge badge--demo">Model – not a physical control</span>
      </div>

      <div className="demo-banner mb-4">
        <span>📐</span>
        <span>
          This simulator uses a <strong>simple linear model</strong> with documented assumptions below.
          Results are illustrative estimates only. No real equipment is changed.
        </span>
      </div>

      <div className="simulator-grid">
        {/* INPUTS */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <div className="simulator-label">Scenario: <strong>Reduce Unnecessary Lighting</strong></div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Eliminate avoidable lighting hours in vacant rooms
            </div>
          </div>

          {/* Room selection */}
          <div className="simulator-input-row">
            <div className="simulator-label">Rooms included</div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {ALL_ROOM_IDS.map(id => (
                <button
                  key={id}
                  id={`sim-room-${id}`}
                  className={`btn btn--sm ${inputs.selectedRooms.includes(id) ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => toggleRoom(id)}
                  aria-pressed={inputs.selectedRooms.includes(id)}
                >
                  {ROOM_METADATA[id].name}
                </button>
              ))}
            </div>
          </div>

          {/* Avoidable lighting hours */}
          <div className="simulator-input-row">
            <label className="simulator-label" htmlFor="sim-hours">
              Avoidable lighting hours / day: <strong style={{ color: 'var(--accent-green)' }}>{inputs.avoidableLightingHours} h</strong>
            </label>
            <input
              id="sim-hours"
              type="range"
              className="input"
              min={0} max={12} step={0.5}
              value={inputs.avoidableLightingHours}
              onChange={e => setField('avoidableLightingHours', parseFloat(e.target.value))}
              aria-valuemin={0} aria-valuemax={12} aria-valuenow={inputs.avoidableLightingHours}
            />
          </div>

          {/* Lighting power */}
          <div className="simulator-input-row">
            <label className="simulator-label" htmlFor="sim-power">
              Lighting power per room: <strong style={{ color: 'var(--accent-green)' }}>{inputs.lightingPowerWattsPerRoom} W</strong>
              <span className="info-pill" style={{ marginLeft: 6 }}>assumption</span>
            </label>
            <input
              id="sim-power"
              type="range"
              className="input"
              min={200} max={3000} step={100}
              value={inputs.lightingPowerWattsPerRoom}
              onChange={e => setField('lightingPowerWattsPerRoom', parseInt(e.target.value))}
              aria-valuemin={200} aria-valuemax={3000} aria-valuenow={inputs.lightingPowerWattsPerRoom}
            />
          </div>

          {/* Tariff */}
          <div className="simulator-input-row">
            <label className="simulator-label" htmlFor="sim-tariff">
              Electricity tariff: <strong style={{ color: 'var(--accent-green)' }}>₹{inputs.tariffInrPerKwh}/kWh</strong>
              <span className="info-pill" style={{ marginLeft: 6 }}>assumption</span>
            </label>
            <input
              id="sim-tariff"
              type="range"
              className="input"
              min={4} max={15} step={0.5}
              value={inputs.tariffInrPerKwh}
              onChange={e => setField('tariffInrPerKwh', parseFloat(e.target.value))}
              aria-valuemin={4} aria-valuemax={15} aria-valuenow={inputs.tariffInrPerKwh}
            />
          </div>

          {/* Days per week */}
          <div className="simulator-input-row">
            <label className="simulator-label" htmlFor="sim-days">
              Policy applies: <strong style={{ color: 'var(--accent-green)' }}>{inputs.daysPerWeek} days/week</strong>
            </label>
            <input
              id="sim-days"
              type="range"
              className="input"
              min={1} max={7} step={1}
              value={inputs.daysPerWeek}
              onChange={e => setField('daysPerWeek', parseInt(e.target.value))}
              aria-valuemin={1} aria-valuemax={7} aria-valuenow={inputs.daysPerWeek}
            />
          </div>

          <button
            id="sim-reset"
            className="btn btn--secondary btn--sm"
            onClick={() => setInputs(DEFAULT_SIMULATOR_INPUTS)}
          >
            ↺ Reset to defaults
          </button>
        </div>

        {/* OUTPUTS */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <div className="simulator-label">Projected Savings</div>
            <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Modeled estimates — not guaranteed results
            </div>
          </div>

          {/* Three time horizons */}
          {(['daily', 'weekly', 'annual'] as const).map(horizon => {
            const energy = outputs[`${horizon}EnergySavedKwh`];
            const cost   = outputs[`${horizon}CostSavedInr`];
            const co2    = outputs[`${horizon}Co2SavedKg`];
            return (
              <div key={horizon} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  {horizon === 'daily' ? '📅 Daily' : horizon === 'weekly' ? '🗓 Weekly' : '📆 Annual'}
                </div>
                <div className="sim-result-grid">
                  <div className="sim-result-card">
                    <div className="sim-result-label">Energy</div>
                    <div className="sim-result-value">{energy.toFixed(1)}</div>
                    <div className="sim-result-unit">kWh</div>
                  </div>
                  <div className="sim-result-card">
                    <div className="sim-result-label">Cost</div>
                    <div className="sim-result-value">₹{cost.toFixed(0)}</div>
                    <div className="sim-result-unit">INR</div>
                  </div>
                  <div className="sim-result-card">
                    <div className="sim-result-label">CO₂</div>
                    <div className="sim-result-value">{co2.toFixed(1)}</div>
                    <div className="sim-result-unit">kg</div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Assumptions toggle */}
          <button
            id="sim-assumptions-toggle"
            className="btn btn--secondary btn--sm w-full"
            onClick={() => setShowAssumptions(v => !v)}
            aria-expanded={showAssumptions}
          >
            {showAssumptions ? '▲' : '▼'} Model assumptions
          </button>

          {showAssumptions && (
            <div style={{ marginTop: 8, background: 'var(--bg-surface)', borderRadius: 8, padding: 12, border: '1px solid var(--border-subtle)' }}>
              <table className="assumption-table">
                <tbody>
                  {Object.entries(outputs.assumptions).map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.70rem' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
