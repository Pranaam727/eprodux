// ============================================================
// RoomDetailPanel – selected room state and related info
// ============================================================

import type { RoomState, Alert, Recommendation } from '../types';

interface Props {
  room: RoomState;
  alerts: Alert[];
  recommendations: Recommendation[];
  onClose: () => void;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatAge(iso: string | null): string {
  if (!iso) return 'no data';
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  return `${Math.round(secs / 60)}m ago`;
}

function ConnectionBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    connected: 'badge--green',
    stale:     'badge--yellow',
    offline:   'badge--red',
    unknown:   'badge--gray',
  };
  return (
    <span className={`badge ${map[state] ?? 'badge--gray'}`}>
      {state.toUpperCase()}
    </span>
  );
}

function LightBadge({ state }: { state: string }) {
  const map: Record<string, string> = { ON: 'badge--green', OFF: 'badge--gray', UNKNOWN: 'badge--yellow' };
  return (
    <span className={`badge ${map[state] ?? 'badge--gray'}`}>
      💡 {state} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(manual input)</span>
    </span>
  );
}

export function RoomDetailPanel({ room, alerts, recommendations, onClose }: Props) {
  const roomAlerts   = alerts.filter(a => a.roomId === room.id && a.status === 'active');
  const roomRecs     = recommendations.filter(r => r.roomId === room.id && r.status === 'pending');

  return (
    <div className="room-detail-panel" role="dialog" aria-label={`${room.name} details`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{room.name}</h2>
          <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
            <ConnectionBadge state={room.connectionState} />
            <LightBadge state={room.lightState} />
            <span className="badge badge--gray">{room.dataSource} data</span>
          </div>
        </div>
        <button
          id={`close-room-detail-${room.id}`}
          className="btn btn--secondary btn--sm"
          onClick={onClose}
          aria-label="Close room detail panel"
        >
          ✕
        </button>
      </div>

      {/* Stale data warning */}
      {room.connectionState === 'stale' && (
        <div className="alert-item alert-item--warning" style={{ marginBottom: 12 }}>
          <span className="alert-icon">⚠️</span>
          <div>
            <div className="alert-title">Stale Data</div>
            <div className="alert-desc">
              Last update was {formatAge(room.lastUpdated)}. Data may not reflect current conditions.
            </div>
          </div>
        </div>
      )}
      {room.connectionState === 'offline' && (
        <div className="alert-item alert-item--critical" style={{ marginBottom: 12 }}>
          <span className="alert-icon">🔴</span>
          <div>
            <div className="alert-title">Camera Offline</div>
            <div className="alert-desc">
              No data received from this room's camera. Occupancy is UNKNOWN — not assumed empty.
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="room-detail-grid">
        <StatCard
          label="Occupancy"
          value={room.occupancy != null ? String(room.occupancy) : 'UNKNOWN'}
          unit="people"
          note="CV estimated"
          color={room.occupancy != null ? 'var(--accent-blue)' : 'var(--alert-critical)'}
        />
        <StatCard
          label="Energy Use"
          value={room.energyKwh != null ? room.energyKwh.toFixed(1) : '—'}
          unit="kWh"
          note="simulated"
          color="var(--alert-warning)"
        />
        <StatCard
          label="CO₂"
          value={room.co2Ppm != null ? String(room.co2Ppm) : '—'}
          unit="ppm"
          note="simulated"
          color={room.co2Ppm != null && room.co2Ppm > 600 ? 'var(--alert-warning)' : 'var(--accent-green)'}
        />
        <StatCard
          label="Temperature"
          value={room.temperatureC != null ? room.temperatureC.toFixed(1) : '—'}
          unit="°C"
          note="simulated"
          color="var(--text-primary)"
        />
        <StatCard
          label="CV Confidence"
          value={room.confidence != null ? `${(room.confidence * 100).toFixed(0)}%` : '—'}
          unit=""
          note="CV model"
          color="var(--text-secondary)"
        />
        <StatCard
          label="Last Update"
          value={formatTimestamp(room.lastUpdated)}
          unit=""
          note={formatAge(room.lastUpdated)}
          color="var(--text-secondary)"
        />
      </div>

      {/* Alerts for this room */}
      {roomAlerts.length > 0 && (
        <>
          <div className="section-header mt-4">
            <span className="section-title">⚠️ Active Alerts</span>
          </div>
          {roomAlerts.map(a => (
            <div key={a.id} className={`alert-item alert-item--${a.severity}`}>
              <span className="alert-icon">{a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : 'ℹ️'}</span>
              <div>
                <div className="alert-title">{a.title}</div>
                <div className="alert-desc">{a.description}</div>
                {a.isDemoScenario && (
                  <div className="alert-meta">⚗️ Demo scenario – based on simulated data</div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Relevant recommendations */}
      {roomRecs.length > 0 && (
        <>
          <div className="section-header mt-4">
            <span className="section-title">💡 Recommendations</span>
          </div>
          {roomRecs.map(r => (
            <div key={r.id} className="rec-item" style={{ marginBottom: 8 }}>
              <div className="rec-title">{r.action}</div>
              <div className="alert-desc mt-2">{r.evidence}</div>
              <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--accent-green)' }}>
                💰 Est. savings: {r.estimatedEnergySavedKwh} kWh · ₹{r.estimatedCostSavedInr} · {r.estimatedCo2SavedKg} kg CO₂ (modeled projection)
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  note,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
  color: string;
}) {
  return (
    <div className="room-detail-stat">
      <div className="room-detail-stat-label">{label}</div>
      <div className="room-detail-stat-value" style={{ color }}>
        {value}
        {unit && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 2 }}>{note}</div>
    </div>
  );
}
