// ============================================================
// RecommendationsPage.tsx — GenAI Sustainability Advisory Page
// Filters, Grounded Evidence, Guideline Citations, & Chat Assistant
// ============================================================

import { useState } from 'react';
import type { Recommendation } from '../../types';
import { ChatAssistant } from '../ChatAssistant';

interface Props {
  recommendations: Recommendation[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function RecommendationsPage({ recommendations, onAccept, onDismiss }: Props) {
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [viewTab, setViewTab] = useState<'cards' | 'chat'>('cards');

  const filteredRecs = recommendations.filter((r) => {
    if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false;
    if (roomFilter !== 'all' && r.roomId !== roomFilter) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── HEADER INTRO & VIEW TOGGLE ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>AI Sustainability Recommendations</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>
            Grounded in university twin evidence and retrieved guidelines. Evaluated with deterministic Python math.
          </p>
        </div>

        {/* View Switcher */}
        <div className="chart-tabs" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`chart-tab ${viewTab === 'cards' ? 'chart-tab--active' : ''}`}
            onClick={() => setViewTab('cards')}
          >
            📋 Actionable Items ({filteredRecs.length})
          </button>
          <button
            type="button"
            className={`chart-tab ${viewTab === 'chat' ? 'chart-tab--active' : ''}`}
            onClick={() => setViewTab('chat')}
          >
            🤖 Ask AI Assistant
          </button>
        </div>
      </div>

      {viewTab === 'chat' ? (
        <div className="card" style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <ChatAssistant />
        </div>
      ) : (
        <>
          {/* ── FILTERS BAR ── */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              flexWrap: 'wrap',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>PRIORITY:</span>
              {(['all', 'high', 'medium', 'low'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`btn btn--sm ${priorityFilter === p ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setPriorityFilter(p)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {p}
                </button>
              ))}
            </div>

            <div style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>ZONE:</span>
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'seminar_hall', label: 'Seminar Hall' },
                  { id: 'classroom', label: 'Classroom' },
                  { id: 'lab', label: 'Laboratory' },
                  { id: 'office', label: 'Office' },
                ] as const
              ).map((rm) => (
                <button
                  key={rm.id}
                  type="button"
                  className={`btn btn--sm ${roomFilter === rm.id ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setRoomFilter(rm.id)}
                >
                  {rm.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── RECOMMENDATIONS GRID ── */}
          {filteredRecs.length === 0 ? (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>No recommendations matching your filter</div>
              <div style={{ fontSize: '0.78rem', marginTop: 4 }}>
                All systems in this zone are currently operating within nominal parameters.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: 20,
              }}
            >
              {filteredRecs.map((rec) => {
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
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

                      {rec.isDemo && <span className="badge badge--demo">DEMO DATA</span>}
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>
                      {rec.issue}
                    </h3>

                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                      📍 Location: <strong>{rec.roomName || rec.roomId}</strong>
                    </div>

                    {/* Evidence Box */}
                    <div
                      style={{
                        background: 'var(--bg-surface)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.76rem',
                        color: 'var(--text-secondary)',
                        borderLeft: '3px solid var(--accent-blue)',
                        marginBottom: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      <strong style={{ color: 'var(--text-primary)' }}>Observed Evidence: </strong>
                      {rec.evidence}
                    </div>

                    {/* Action */}
                    <div style={{ fontSize: '0.82rem', marginBottom: 16, lineHeight: 1.5 }}>
                      <strong style={{ color: 'var(--accent-green)' }}>Recommended Action: </strong>
                      {rec.action}
                    </div>

                    {/* Modeled Savings Box */}
                    <div
                      style={{
                        background: 'rgba(34, 197, 94, 0.06)',
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 14px',
                        marginBottom: 16,
                        marginTop: 'auto',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span className="text-xs text-muted">POTENTIAL IMPACT (MODELED)</span>
                        <span style={{ fontSize: '0.66rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                          Deterministic Projection
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div>
                          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-green)' }}>
                            {rec.estimatedEnergySavedKwh.toFixed(1)}
                          </span>
                          <span className="text-xs text-muted"> kWh</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-green)' }}>
                            ₹{rec.estimatedCostSavedInr.toFixed(0)}
                          </span>
                          <span className="text-xs text-muted"> saved</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-green)' }}>
                            {rec.estimatedCo2SavedKg.toFixed(2)}
                          </span>
                          <span className="text-xs text-muted"> kg CO₂</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {isAccepted ? (
                        <div style={{ fontSize: '0.74rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                          ✓ Acknowledged for Review (Audit Log Updated)
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
          )}
        </>
      )}
    </div>
  );
}
