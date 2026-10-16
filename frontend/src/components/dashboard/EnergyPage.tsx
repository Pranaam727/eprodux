// ============================================================
// EnergyPage.tsx — Energy & Resources Analytics Dashboard
// Room-by-room energy, CO2 and Temperature Trends, and What-If Simulator
// ============================================================

import { useState } from 'react';
import type { FloorState } from '../../types';
import { WhatIfSimulator } from '../WhatIfSimulator';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';

interface Props {
  floorState: FloorState | null;
}

export function EnergyPage({ floorState }: Props) {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('day');

  // Multi-room comparative data
  const roomEnergyComparison = [
    { room: 'Seminar Hall', energyKwh: 3.6, occupancy: 0, status: 'Lights ON (Waste)', color: '#F5B82E' },
    { room: 'Classroom', energyKwh: 2.1, occupancy: 28, status: 'Normal In-Use', color: '#A3D900' },
    { room: 'Laboratory', energyKwh: 4.8, occupancy: 7, status: 'Equipment Active', color: '#00B8D9' },
    { room: 'Office', energyKwh: 1.2, occupancy: 2, status: 'Standby / Low', color: '#0645A5' },
  ];

  // Environmental trends data
  const envTrendData = [
    { time: '08:00', co2Classroom: 420, co2Seminar: 410, tempClassroom: 23.2, tempSeminar: 22.8 },
    { time: '10:00', co2Classroom: 650, co2Seminar: 412, tempClassroom: 25.1, tempSeminar: 23.5 },
    { time: '12:00', co2Classroom: 820, co2Seminar: 415, tempClassroom: 26.8, tempSeminar: 24.1 },
    { time: '14:00', co2Classroom: 710, co2Seminar: 412, tempClassroom: 26.4, tempSeminar: 24.2 },
    { time: '16:00', co2Classroom: 540, co2Seminar: 411, tempClassroom: 25.0, tempSeminar: 23.9 },
    { time: '18:00', co2Classroom: 440, co2Seminar: 410, tempClassroom: 23.8, tempSeminar: 23.2 },
  ];

  const totalKwh = floorState?.totalEnergyKwh ?? 11.7;
  const costTodayInr = (totalKwh * 8.0).toFixed(0);
  const co2TodayKg = (totalKwh * 0.82).toFixed(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── HEADER INTRO & TIME RANGE ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>Energy & Resource Intelligence</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
            Sub-meter electricity tracking, ambient temperature & CO₂ levels with verified mathematical conversions.
          </p>
        </div>

        {/* Time Filter */}
        <div className="chart-tabs" style={{ marginBottom: 0 }}>
          {(['day', 'week', 'month'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`chart-tab ${timeRange === t ? 'chart-tab--active' : ''}`}
              onClick={() => setTimeRange(t)}
            >
              {t === 'day' ? 'Today (24h)' : t === 'week' ? 'Past 7 Days' : 'Monthly View'}
            </button>
          ))}
        </div>
      </div>

      {/* ── RESOURCE SUMMARY CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="card card--compact" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
          <div className="text-xs text-muted">METER CONSUMPTION</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-accent)', marginTop: 4 }}>
            {totalKwh} <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>kWh</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Simulated campus sub-meter reading
          </div>
        </div>

        <div className="card card--compact" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
          <div className="text-xs text-muted">ESTIMATED ELECTRICITY COST</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>
            ₹{costTodayInr}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Formula: kWh × ₹8.00 / kWh tariff
          </div>
        </div>

        <div className="card card--compact" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
          <div className="text-xs text-muted">ESTIMATED CO₂ EMISSIONS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: 4 }}>
            {co2TodayKg} <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>kg</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Formula: kWh × 0.82 kg CO₂ / kWh
          </div>
        </div>

        <div className="card card--compact" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
          <div className="text-xs text-muted">IDENTIFIED ENERGY WASTE</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-error)', marginTop: 4 }}>
            3.2 <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>kWh</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Seminar Hall vacant with lighting ON
          </div>
        </div>
      </div>

      {/* ── COMPARATIVE CHARTS GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Room Energy Consumption Bar Chart */}
        <div className="chart-container" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
          <div className="section-title" style={{ marginBottom: 4 }}>
            Energy Usage by Monitored Room (kWh)
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Comparison across the 4 campus zones
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={roomEnergyComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="room" stroke="#A8B4CC" tick={{ fontSize: 11 }} />
              <YAxis stroke="#A8B4CC" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#07132D', border: '1px solid #1A2945', borderRadius: 8, fontSize: 11, color: '#F7FAFF' }}
              />
              <Bar dataKey="energyKwh" fill="#00B8D9" radius={[4, 4, 0, 0]} name="Consumption (kWh)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Environmental Trends Line Chart */}
        <div className="chart-container" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
          <div className="section-title" style={{ marginBottom: 4 }}>
            CO₂ Concentration Trends (PPM)
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Classroom (populated) vs. Seminar Hall (vacant)
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={envTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="time" stroke="#A8B4CC" tick={{ fontSize: 11 }} />
              <YAxis stroke="#A8B4CC" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#07132D', border: '1px solid #1A2945', borderRadius: 8, fontSize: 11, color: '#F7FAFF' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#A8B4CC' }} />
              <Line type="monotone" dataKey="co2Classroom" stroke="#A3D900" strokeWidth={2} name="Classroom CO₂ (ppm)" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="co2Seminar" stroke="#F5B82E" strokeWidth={2} name="Seminar Hall CO₂ (ppm)" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── DOCUMENTED MATHEMATICAL ASSUMPTIONS ── */}
      <div
        className="card"
        style={{
          background: 'var(--color-card-elevated)',
          border: '1px solid var(--color-border)',
          padding: 18,
        }}
      >
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-green)', marginBottom: 8, textTransform: 'uppercase' }}>
          Documented Savings Formulas & Tariff Assumptions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
          <div>
            <strong>1. Energy Reduction Formula:</strong>
            <div className="font-mono" style={{ color: 'var(--text-primary)', marginTop: 2 }}>
              kWh_saved = power_kW × avoidable_hours × 0.80
            </div>
          </div>
          <div>
            <strong>2. Financial Savings Formula:</strong>
            <div className="font-mono" style={{ color: 'var(--text-primary)', marginTop: 2 }}>
              ₹_saved = kWh_saved × ₹8.00/kWh tariff
            </div>
          </div>
          <div>
            <strong>3. Carbon Abatement Formula:</strong>
            <div className="font-mono" style={{ color: 'var(--text-primary)', marginTop: 2 }}>
              CO₂_saved = kWh_saved × 0.82 kg CO₂/kWh
            </div>
          </div>
        </div>
      </div>

      {/* ── WHAT-IF SIMULATOR ── */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>
          INTERACTIVE WHAT-IF SUSTAINABILITY SIMULATOR
        </div>
        <WhatIfSimulator />
      </div>
    </div>
  );
}
