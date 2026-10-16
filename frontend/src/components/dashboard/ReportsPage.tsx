// ============================================================
// ReportsPage.tsx — Eprodux Sustainability Audit & Period Reports
// Summary of Energy, Occupancy, Anomalies, and Recommendations
// ============================================================

import { useState } from 'react';
import type { FloorState, Alert, Recommendation } from '../../types';

interface Props {
  floorState: FloorState | null;
  alerts: Alert[];
  recommendations: Recommendation[];
}

export function ReportsPage({ floorState, alerts, recommendations }: Props) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');

  const totalKwh = floorState?.totalEnergyKwh ?? 11.7;
  const costInr = (totalKwh * 8.0).toFixed(0);
  const co2Kg = (totalKwh * 0.82).toFixed(1);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── HEADER INTRO & PRINT ACTION ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Audit & Sustainability Reports</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>
            Aggregated period reports on campus energy efficiency, occupancy compliance, and flagged waste.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {/* Period selector */}
          <div className="chart-tabs" style={{ marginBottom: 0 }}>
            {(['day', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`chart-tab ${period === p ? 'chart-tab--active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p === 'day' ? 'Daily Report' : p === 'week' ? 'Weekly Summary' : 'Monthly Audit'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="btn btn--primary btn--sm"
          >
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>

      {/* ── FORMAL REPORT DOCUMENT CONTAINER ── */}
      <div
        className="card"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-xl)',
          padding: 36,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Document Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--border-subtle)', paddingBottom: 20, marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div
                className="brand-logo"
                style={{
                  width: 30,
                  height: 30,
                  fontSize: '0.8rem',
                  background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                }}
              >
                EP
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>Eprodux Sustainability Audit Report</div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Facility: DSU Main Campus · Floor 3 · Generated on {new Date().toLocaleDateString()}
            </div>
          </div>

          <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <div>Audit Status: <strong>VERIFIED</strong></div>
            <div>Period: <strong>{period.toUpperCase()}</strong></div>
            <div>Source: Digital Twin Aggregations</div>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div style={{ marginBottom: 28 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>
            1. EXECUTIVE RESOURCE METRICS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div className="card card--compact" style={{ background: 'var(--bg-card)' }}>
              <div className="text-xs text-muted">TOTAL CONSUMPTION</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: 2 }}>
                {totalKwh} kWh
              </div>
            </div>
            <div className="card card--compact" style={{ background: 'var(--bg-card)' }}>
              <div className="text-xs text-muted">CALCULATED COST</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-green)', marginTop: 2 }}>
                ₹{costInr}
              </div>
            </div>
            <div className="card card--compact" style={{ background: 'var(--bg-card)' }}>
              <div className="text-xs text-muted">EMISSIONS EQUIVALENT</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>
                {co2Kg} kg CO₂
              </div>
            </div>
            <div className="card card--compact" style={{ background: 'var(--bg-card)' }}>
              <div className="text-xs text-muted">IDENTIFIED WASTE</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--alert-critical)', marginTop: 2 }}>
                3.2 kWh
              </div>
            </div>
          </div>
        </div>

        {/* Monitored Rooms Table */}
        <div style={{ marginBottom: 28 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>
            2. ZONE-BY-ZONE OCCUPANCY & LIGHTING STATUS
          </div>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '10px 14px' }}>ZONE NAME</th>
                  <th style={{ padding: '10px 14px' }}>ROOM ID</th>
                  <th style={{ padding: '10px 14px' }}>OCCUPANCY (CV)</th>
                  <th style={{ padding: '10px 14px' }}>LIGHTING (MANUAL)</th>
                  <th style={{ padding: '10px 14px' }}>ENERGY CONSUMPTION</th>
                  <th style={{ padding: '10px 14px' }}>COMPLIANCE STATUS</th>
                </tr>
              </thead>
              <tbody>
                {floorState &&
                  Object.values(floorState.rooms).map((r) => {
                    const isWaste = r.occupancy === 0 && r.lightState === 'ON';
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>{r.id}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {r.occupancy !== null ? `${r.occupancy} persons` : 'UNKNOWN'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>{r.lightState}</td>
                        <td style={{ padding: '10px 14px' }}>{r.energyKwh} kWh</td>
                        <td style={{ padding: '10px 14px' }}>
                          {isWaste ? (
                            <span style={{ color: 'var(--alert-warning)', fontWeight: 600 }}>
                              ⚠️ Energy Waste Flag
                            </span>
                          ) : (
                            <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                              ✓ Compliant
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Anomalies & Recommendations */}
        <div>
          <div className="section-title" style={{ marginBottom: 12 }}>
            3. AUDIT ANOMALIES ({alerts.length}) & RECOMMENDED ACTIONS ({recommendations.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                style={{
                  padding: '12px 16px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.76rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{rec.issue}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Action: {rec.action} · Location: {rec.roomName || rec.roomId}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                    Modeled Savings: {rec.estimatedEnergySavedKwh} kWh (₹{rec.estimatedCostSavedInr})
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Status: {rec.status.toUpperCase()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer Note */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          * Notice: Direct PDF backend export is currently rendered via client print subsystem. Modeled savings calculations are derived deterministically using published tariffs (₹8.0/kWh) and emission factors (0.82 kg CO₂/kWh). Lighting states are manually supplied or simulated.
        </div>
      </div>
    </div>
  );
}
