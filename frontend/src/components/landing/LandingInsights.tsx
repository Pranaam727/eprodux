// ============================================================
// LandingInsights.tsx — GenAI Sustainability Insights Preview
// Directly bound to canonical recommendations contract.
// ============================================================

import type { Recommendation } from '../../types';

interface Props {
  recommendations: Recommendation[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onExploreInsights: () => void;
}

export function LandingInsights({
  recommendations,
  onAccept,
  onDismiss,
  onExploreInsights,
}: Props) {
  const activeRecs = recommendations.slice(0, 3);

  return (
    <section
      id="insights-section"
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
            GENAI THINK ENGINE
          </div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 800 }}>
            Automated Sustainability Recommendations
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.90rem', marginTop: 4 }}>
            Grounded in university twin evidence and verified with deterministic savings mathematics.
          </p>
        </div>

        <button
          type="button"
          onClick={onExploreInsights}
          className="btn btn--secondary"
        >
          Explore All AI Insights →
        </button>
      </div>

      {/* Recommendations Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {activeRecs.map((rec) => {
          const isAccepted = rec.status === 'accepted';
          const isDismissed = rec.status === 'dismissed';

          return (
            <div
              key={rec.id}
              className={`card ${isAccepted ? 'card--accent' : ''}`}
              style={{
                background: isAccepted ? 'rgba(34, 197, 94, 0.04)' : 'var(--bg-card)',
                opacity: isDismissed ? 0.45 : 1,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <span
                    className={`badge badge--${
                      rec.priority === 'high' ? 'red' : rec.priority === 'medium' ? 'yellow' : 'gray'
                    }`}
                  >
                    {rec.priority.toUpperCase()} PRIORITY
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                    ID: {rec.id}
                  </span>
                </div>

                {rec.isDemo && <span className="badge badge--demo">DEMO</span>}
              </div>

              {/* Title / Issue */}
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>
                {rec.issue}
              </h3>

              {/* Location */}
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                📍 Location: <strong>{rec.roomName || rec.roomId}</strong>
              </div>

              {/* Evidence */}
              <div
                style={{
                  background: 'var(--bg-surface)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  borderLeft: '3px solid var(--accent-blue)',
                  marginBottom: 12,
                  lineHeight: 1.5,
                }}
              >
                <strong>Observed Evidence:</strong> {rec.evidence}
              </div>

              {/* Action */}
              <div style={{ fontSize: '0.80rem', color: 'var(--text-primary)', marginBottom: 16, lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--accent-green)' }}>Recommended Action: </strong>
                {rec.action}
              </div>

              {/* Modeled Savings Box */}
              <div
                style={{
                  background: 'rgba(34, 197, 94, 0.06)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  marginBottom: 16,
                  marginTop: 'auto',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="text-xs text-muted">POTENTIAL IMPACT (MODELED)</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                    Deterministic Projection
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-green)' }}>
                      {rec.estimatedEnergySavedKwh.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted"> kWh</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-green)' }}>
                      ₹{rec.estimatedCostSavedInr.toFixed(0)}
                    </span>
                    <span className="text-xs text-muted"> saved</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-green)' }}>
                      {rec.estimatedCo2SavedKg.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted"> kg CO₂</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {isAccepted ? (
                  <div style={{ fontSize: '0.74rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                    ✓ Accepted for Review (Audit Log Updated)
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onAccept(rec.id)}
                      className="btn btn--primary btn--sm"
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      Accept for Review
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismiss(rec.id)}
                      className="btn btn--secondary btn--sm"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
