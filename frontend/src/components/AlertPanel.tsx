// ============================================================
// AlertPanel – all active floor alerts with severity indicators
// ============================================================

import type { Alert, AlertSeverity } from '../types';

interface Props {
  alerts: Alert[];
}

function severityIcon(s: AlertSeverity): string {
  return s === 'critical' ? '🔴' : s === 'warning' ? '🟡' : 'ℹ️';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function AlertPanel({ alerts }: Props) {
  const active = alerts.filter(a => a.status === 'active');

  if (active.length === 0) {
    return (
      <div className="card card--compact">
        <div className="section-header" style={{ marginBottom: 0 }}>
          <span className="section-title">🔔 Alerts</span>
        </div>
        <div className="error-state" style={{ padding: 24 }}>
          <div className="icon">✅</div>
          <div style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>No active alerts</div>
        </div>
      </div>
    );
  }

  const sorted = [...active].sort((a, b) => {
    const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="card card--compact" role="region" aria-label="Active alerts">
      <div className="section-header">
        <span className="section-title">🔔 Active Alerts</span>
        <span className="badge badge--red">{active.filter(a => a.severity === 'critical').length} critical</span>
      </div>

      {sorted.map(alert => (
        <div
          key={alert.id}
          id={`alert-${alert.id}`}
          className={`alert-item alert-item--${alert.severity}`}
          role="alert"
          aria-live="polite"
        >
          <span className="alert-icon" aria-hidden="true">{severityIcon(alert.severity)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center justify-between gap-2">
              <div className="alert-title truncate">{alert.title}</div>
              <span className="badge badge--gray" style={{ flexShrink: 0 }}>{alert.roomName}</span>
            </div>
            <div className="alert-desc">{alert.description}</div>
            <div className="alert-meta flex gap-3">
              <span>🕒 {formatTime(alert.timestamp)}</span>
              {alert.isDemoScenario && <span>⚗️ Demo scenario</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
