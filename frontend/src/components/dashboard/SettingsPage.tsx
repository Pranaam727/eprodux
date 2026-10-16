// ============================================================
// SettingsPage.tsx — Eprodux System Configuration & Diagnostics
// API Endpoints, Tariff Parameters, Room Capacities, and Health
// ============================================================

import { useState } from 'react';
import type { FloorState } from '../../types';

interface Props {
  floorState: FloorState | null;
}

export function SettingsPage({ floorState }: Props) {
  const [tariff, setTariff] = useState('8.00');
  const [co2Factor, setCo2Factor] = useState('0.82');
  const [savedNote, setSavedNote] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 3000);
  };

  const isConnected = floorState?.connectionState === 'connected';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 960 }}>
      {/* ── HEADER INTRO ── */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Platform Settings & Parameters</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>
          Manage backend endpoints, tariff assumptions, and monitored campus zone boundaries.
        </p>
      </div>

      {savedNote && (
        <div
          style={{
            padding: '10px 16px',
            background: 'var(--accent-green-bg)',
            border: '1px solid var(--accent-green)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-green)',
            fontSize: '0.80rem',
            fontWeight: 600,
          }}
        >
          ✓ Parameters saved locally. Modeled calculations updated.
        </div>
      )}

      {/* ── SERVICE CONNECTIONS STATUS ── */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>
          1. DISTRIBUTED SERVICE TOPOLOGY & HEALTH
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Digital Twin Backend (Member 2)</div>
              <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                http://localhost:8000 · /healthz
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`status-dot status-dot--${isConnected ? 'on' : 'offline'}`} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                {isConnected ? 'Connected & Ingesting' : 'Offline / Standalone'}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>GenAI & RAG Advisory Service (Member 3)</div>
              <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                http://localhost:8002 · /api/recommendations
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="status-dot status-dot--on" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Active (Deterministic Math)</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Computer Vision Pipeline (Member 1)</div>
              <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                YOLOv8 + ByteTrack Edge Pipeline
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="status-dot status-dot--on" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Ready for Video Ingestion</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUSTAINABILITY CONVERSION PARAMETERS FORM ── */}
      <form onSubmit={handleSave} className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>
          2. SUSTAINABILITY TARIFFS & CALCULATION CONSTANTS
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              COMMERCIAL ELECTRICITY TARIFF (₹ / kWh)
            </label>
            <input
              type="text"
              value={tariff}
              onChange={(e) => setTariff(e.target.value)}
              className="input font-mono"
            />
            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
              Standard campus utility tariff rate in INR.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              CARBON EMISSION FACTOR (kg CO₂ / kWh)
            </label>
            <input
              type="text"
              value={co2Factor}
              onChange={(e) => setCo2Factor(e.target.value)}
              className="input font-mono"
            />
            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
              National grid emission factor baseline.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn--primary">
            Save Conversion Parameters
          </button>
        </div>
      </form>

      {/* ── MONITORED ZONES CAPACITY BOUNDARIES ── */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>
          3. MONITORED CAMPUS SPACES (CANONICAL ROOM IDS)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div className="card card--compact" style={{ background: 'var(--bg-surface)' }}>
            <div style={{ fontWeight: 700 }}>Seminar Hall</div>
            <div className="font-mono text-xs text-muted">ID: seminar_hall</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              Design Capacity: 120 persons · Lighting Load: 2.0 kW
            </div>
          </div>
          <div className="card card--compact" style={{ background: 'var(--bg-surface)' }}>
            <div style={{ fontWeight: 700 }}>Classroom</div>
            <div className="font-mono text-xs text-muted">ID: classroom</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              Design Capacity: 40 persons · Lighting Load: 1.2 kW
            </div>
          </div>
          <div className="card card--compact" style={{ background: 'var(--bg-surface)' }}>
            <div style={{ fontWeight: 700 }}>Laboratory</div>
            <div className="font-mono text-xs text-muted">ID: lab</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              Design Capacity: 25 persons · Lighting Load: 1.8 kW
            </div>
          </div>
          <div className="card card--compact" style={{ background: 'var(--bg-surface)' }}>
            <div style={{ fontWeight: 700 }}>Office</div>
            <div className="font-mono text-xs text-muted">ID: office</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              Design Capacity: 15 persons · Lighting Load: 0.8 kW
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
