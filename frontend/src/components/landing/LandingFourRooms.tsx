// ============================================================
// LandingFourRooms.tsx — Four Monitored Campus Zones Overview
// ============================================================

import type { FloorState, RoomId, RoomState } from '../../types';

interface Props {
  floorState: FloorState | null;
  selectedRoomId: RoomId | null;
  onRoomSelect: (roomId: RoomId) => void;
}

const ROOM_META: Record<
  RoomId,
  {
    icon: string;
    designation: string;
    purpose: string;
    capacity: number;
    fixtureCount: number;
  }
> = {
  seminar_hall: {
    icon: '🎭',
    designation: 'Room 301 · Tiered Lecture Hall',
    purpose: 'Large presentations, academic symposiums & guest lectures',
    capacity: 120,
    fixtureCount: 24,
  },
  classroom: {
    icon: '📚',
    designation: 'Room 302 · Standard Learning Space',
    purpose: 'Daily undergraduate coursework, tutorials & group study',
    capacity: 40,
    fixtureCount: 12,
  },
  lab: {
    icon: '🔬',
    designation: 'Room 303 · Advanced Research Lab',
    purpose: 'Scientific experiments, computing rigs & equipment testing',
    capacity: 25,
    fixtureCount: 16,
  },
  office: {
    icon: '💼',
    designation: 'Room 304 · Faculty Workspaces',
    purpose: 'Department faculty offices, administrative desks & consultations',
    capacity: 15,
    fixtureCount: 8,
  },
};

export function LandingFourRooms({ floorState, selectedRoomId, onRoomSelect }: Props) {
  const rooms = (Object.keys(ROOM_META) as RoomId[]).map((id) => {
    const meta = ROOM_META[id];
    const state: RoomState | undefined = floorState?.rooms[id];
    return { id, meta, state };
  });

  return (
    <section
      id="twin-section"
      style={{
        padding: '64px 24px',
        maxWidth: 1600,
        margin: '0 auto',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--accent-green)',
              marginBottom: 8,
            }}
          >
            CAMPUS ZONE COVERAGE
          </div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 800 }}>
            Four Monitored University Spaces
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.90rem', marginTop: 4 }}>
            Real-time telemetry and occupancy tracking mapped across canonical room IDs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <span className="badge badge--green">✓ 4 Canonical Zones</span>
          <span className="badge badge--blue">Single Floor Twin</span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {rooms.map(({ id, meta, state }) => {
          const isSelected = selectedRoomId === id;
          const occ = state?.occupancy ?? null;
          const light = state?.lightState ?? 'UNKNOWN';
          const isOffline = state?.connectionState === 'offline';
          const isWasting = occ === 0 && light === 'ON';

          return (
            <div
              key={id}
              className={`card ${isSelected ? 'card--accent' : ''}`}
              style={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}
              onClick={() => onRoomSelect(id)}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.6rem' }}>{meta.icon}</span>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{state?.name ?? id}</h3>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      ID: <code className="font-mono">{id}</code>
                    </div>
                  </div>
                </div>

                <span
                  className={`status-dot status-dot--${
                    isOffline ? 'offline' : light === 'ON' ? 'on' : 'off'
                  }`}
                />
              </div>

              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                {meta.purpose}
              </p>

              {/* Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <div className="card card--compact" style={{ background: 'var(--bg-surface)' }}>
                  <div className="text-xs text-muted">OCCUPANCY</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 2 }}>
                    {isOffline ? (
                      <span style={{ color: 'var(--alert-critical)' }}>OFFLINE</span>
                    ) : occ !== null ? (
                      `${occ} / ${meta.capacity}`
                    ) : (
                      'UNKNOWN'
                    )}
                  </div>
                  <div className="text-xs text-muted">CV estimated</div>
                </div>

                <div className="card card--compact" style={{ background: 'var(--bg-surface)' }}>
                  <div className="text-xs text-muted">LIGHTING</div>
                  <div
                    style={{
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      marginTop: 2,
                      color: light === 'ON' ? 'var(--accent-green)' : 'var(--text-secondary)',
                    }}
                  >
                    {light}
                  </div>
                  <div className="text-xs text-muted">manual/simulated</div>
                </div>
              </div>

              {/* Environmental Row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.70rem',
                  marginBottom: 16,
                  color: 'var(--text-secondary)',
                }}
              >
                <span>⚡ {state?.energyKwh !== null ? `${state?.energyKwh} kWh` : 'Simulated'}</span>
                <span>🌿 {state?.co2Ppm !== null ? `${state?.co2Ppm} ppm` : 'Simulated'}</span>
                <span>🌡️ {state?.temperatureC !== null ? `${state?.temperatureC}°C` : 'Simulated'}</span>
              </div>

              {/* Waste Alert Pill if unoccupied with lights ON */}
              {isWasting && (
                <div
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--alert-warning-bg)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: 'var(--alert-warning)',
                    fontSize: '0.70rem',
                    fontWeight: 600,
                    marginBottom: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>⚠️</span>
                  <span>Unoccupied room with lights left ON</span>
                </div>
              )}

              {/* Card Footer Button */}
              <button
                type="button"
                className={`btn btn--sm ${isSelected ? 'btn--primary' : 'btn--secondary'}`}
                style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}
              >
                {isSelected ? '✓ Selected in 3D Canvas' : 'Focus in 3D Digital Twin'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
