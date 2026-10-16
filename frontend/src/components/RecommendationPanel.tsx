// ============================================================
// RecommendationPanel – GenAI recommendations with
// Accept / Dismiss actions and visible UI feedback
// ============================================================

import type { Recommendation, Priority } from '../types';

interface Props {
  recommendations: Recommendation[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

function priorityBadge(p: Priority) {
  const map: Record<Priority, string> = { high: 'badge--red', medium: 'badge--yellow', low: 'badge--gray' };
  return <span className={`badge ${map[p]}`}>{p.toUpperCase()}</span>;
}

export function RecommendationPanel({ recommendations, onAccept, onDismiss }: Props) {
  const sorted = [...recommendations].sort((a, b) => {
    const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  return (
    <div role="region" aria-label="GenAI recommendations">
      <div className="section-header">
        <span className="section-title">💡 Recommendations</span>
        <div className="flex gap-2">
          <span className="badge badge--demo">
            {sorted.some(r => r.isDemo) ? '⚗️ Demo' : 'Live'}
          </span>
          <span className="badge badge--gray">
            {sorted.filter(r => r.status === 'pending').length} pending
          </span>
        </div>
      </div>

      <div className="demo-banner mb-4">
        <span>⚗️</span>
        <span>
          Recommendations below are based on simulated data. Estimated savings are
          <strong> modeled projections</strong>, not measured results.
          Accepting a recommendation updates the dashboard state only — no physical equipment is changed.
        </span>
      </div>

      {sorted.length === 0 && (
        <div className="error-state">
          <div className="icon">✅</div>
          <div>No recommendations at this time.</div>
        </div>
      )}

      {sorted.map(rec => (
        <div
          key={rec.id}
          id={`rec-${rec.id}`}
          className={`rec-item${rec.status === 'accepted' ? ' rec-item--accepted' : ''}${rec.status === 'dismissed' ? ' rec-item--dismissed' : ''}`}
          aria-label={`Recommendation: ${rec.issue}`}
        >
          {/* Header */}
          <div className="rec-header">
            <div>
              <div className="flex gap-2 mb-2">
                {priorityBadge(rec.priority)}
                <span className="badge badge--blue">{rec.roomName}</span>
                {rec.isDemo && <span className="badge badge--demo">Demo</span>}
                {rec.status === 'accepted' && <span className="badge badge--green">✓ Accepted</span>}
                {rec.status === 'dismissed' && <span className="badge badge--gray">Dismissed</span>}
              </div>
              <div className="rec-title">{rec.issue}</div>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              #{rec.id}
            </span>
          </div>

          {/* Evidence */}
          <div className="rec-evidence">{rec.evidence}</div>

          {/* Action */}
          <div style={{ marginTop: 8, fontSize: '0.80rem', color: 'var(--text-primary)' }}>
            <strong style={{ color: 'var(--accent-green)' }}>→ Action:</strong> {rec.action}
          </div>

          {/* Projected savings */}
          {(rec.estimatedEnergySavedKwh > 0 || rec.estimatedCostSavedInr > 0) && (
            <div className="rec-savings">
              <div className="rec-saving-item">
                <div className="rec-saving-value">⚡ {rec.estimatedEnergySavedKwh} kWh</div>
                <div>energy saved / event</div>
              </div>
              <div className="rec-saving-item">
                <div className="rec-saving-value">₹ {rec.estimatedCostSavedInr}</div>
                <div>cost saved (proj.)</div>
              </div>
              <div className="rec-saving-item">
                <div className="rec-saving-value">🌿 {rec.estimatedCo2SavedKg} kg</div>
                <div>CO₂ avoided (proj.)</div>
              </div>
            </div>
          )}

          {/* Guideline */}
          {rec.guideline && (
            <div className="rec-guideline">📋 {rec.guideline}</div>
          )}

          {/* Actions */}
          {rec.status === 'pending' && (
            <div className="rec-actions">
              <button
                id={`accept-rec-${rec.id}`}
                className="btn btn--primary btn--sm"
                onClick={() => onAccept(rec.id)}
                aria-label={`Accept recommendation: ${rec.issue}`}
              >
                ✓ Accept
              </button>
              <button
                id={`dismiss-rec-${rec.id}`}
                className="btn btn--danger btn--sm"
                onClick={() => onDismiss(rec.id)}
                aria-label={`Dismiss recommendation: ${rec.issue}`}
              >
                ✕ Dismiss
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
