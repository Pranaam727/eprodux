// ============================================================
// AnalysisResultsModal.tsx — CV Video Inference Results Viewer
// Displays zone occupancy, lighting provenance, anomalies, and
// provides one-click inspection in the 3D Digital Twin.
// ============================================================

import type { VideoAnalysisResult, RoomId } from '../types';

interface Props {
  result: VideoAnalysisResult | null;
  isOpen: boolean;
  onClose: () => void;
  onInspectRoom: (roomId: RoomId) => void;
}

export function AnalysisResultsModal({ result, isOpen, onClose, onInspectRoom }: Props) {
  if (!isOpen || !result) return null;

  const handleInspect = (roomId: RoomId) => {
    onInspectRoom(roomId);
    onClose();
  };

  const observations = Object.values(result.observations);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 15, 30, 0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="results-modal-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 820,
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius-xl)',
          padding: 28,
          boxShadow: 'var(--shadow-popup)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="badge badge--green">✓ COMPLETED</span>
              {result.isDemo && <span className="badge badge--demo">⚗️ DEMO DATA</span>}
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Job ID: {result.jobId}</span>
            </div>
            <h2 id="results-modal-title" style={{ fontSize: '1.3rem', fontWeight: 800 }}>
              CV Analysis Results — {result.fileName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.3rem',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Warnings Banner */}
        {result.warnings.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {result.warnings.map((warn, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  background: 'rgba(168, 85, 247, 0.1)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  color: '#c084fc',
                  fontSize: '0.74rem',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>ℹ️</span>
                <span>{warn}</span>
              </div>
            ))}
          </div>
        )}

        {/* Video Metadata Pills */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            marginBottom: 20,
          }}
        >
          <div className="card card--compact" style={{ background: 'var(--bg-card)' }}>
            <div className="text-xs text-muted">VIDEO DURATION</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 2 }}>{result.durationSeconds}s</div>
          </div>
          <div className="card card--compact" style={{ background: 'var(--bg-card)' }}>
            <div className="text-xs text-muted">PROCESSED FRAMES</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 2 }}>{result.totalFrames.toLocaleString()}</div>
          </div>
          <div className="card card--compact" style={{ background: 'var(--bg-card)' }}>
            <div className="text-xs text-muted">INFERENCE FPS</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 2 }}>{result.fps} FPS</div>
          </div>
          <div className="card card--compact" style={{ background: 'var(--bg-card)' }}>
            <div className="text-xs text-muted">FILE SIZE</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 2 }}>
              {(result.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div
          style={{
            padding: 14,
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid var(--border-accent)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 24,
            fontSize: '0.82rem',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'var(--accent-green)' }}>Analysis Synthesis: </strong>
          {result.summary}
        </div>

        {/* 4-Room Occupancy Breakdown */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>
            Monitored Zones & Occupancy Findings
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {observations.map((obs) => {
              const isAnomaly = obs.anomalies.length > 0;
              return (
                <div
                  key={obs.roomId}
                  className="card card--compact"
                  style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${isAnomaly ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-card)'}`,
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{obs.roomName}</span>
                      <span className="text-xs text-muted font-mono">({obs.roomId})</span>
                    </div>
                    <span className="badge badge--green">
                      {Math.round(obs.confidence * 100)}% Conf.
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
                    <div>
                      <span className="text-xs text-muted">CURRENT</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                        {obs.currentOccupancy !== null ? obs.currentOccupancy : 'UNKNOWN'}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">PEAK</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{obs.peakOccupancy}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">AVERAGE</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{obs.averageOccupancy}</div>
                    </div>
                  </div>

                  {/* Lighting Provenance Note */}
                  <div
                    style={{
                      fontSize: '0.70rem',
                      color: 'var(--text-secondary)',
                      padding: '4px 8px',
                      background: 'var(--bg-surface)',
                      borderRadius: 4,
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Lighting: <strong>{obs.lightingState}</strong></span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      source: {obs.lightingProvenance} (NOT CV)
                    </span>
                  </div>

                  {/* Anomaly callout */}
                  {isAnomaly && (
                    <div
                      style={{
                        fontSize: '0.70rem',
                        color: 'var(--alert-critical)',
                        background: 'var(--alert-critical-bg)',
                        padding: '4px 8px',
                        borderRadius: 4,
                        marginBottom: 10,
                      }}
                    >
                      ⚠️ {obs.anomalies[0]}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleInspect(obs.roomId)}
                    className="btn btn--secondary btn--sm w-full"
                    style={{ justifyContent: 'center' }}
                  >
                    🔍 Inspect in 3D Digital Twin
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Occupancy Timeline Table */}
        <div style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>
            Sample Chronological Occupancy Detections
          </div>
          <div
            style={{
              maxHeight: 180,
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 12px' }}>TIMECODE</th>
                  <th style={{ padding: '6px 12px' }}>ZONE</th>
                  <th style={{ padding: '6px 12px' }}>DETECTED OCCUPANCY</th>
                  <th style={{ padding: '6px 12px' }}>CONFIDENCE</th>
                </tr>
              </thead>
              <tbody>
                {result.timeline.map((evt, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)' }}>{evt.timecode}</td>
                    <td style={{ padding: '6px 12px', textTransform: 'capitalize' }}>
                      {evt.roomId.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '6px 12px', fontWeight: 600 }}>{evt.occupancy} persons</td>
                    <td style={{ padding: '6px 12px', color: 'var(--accent-green)' }}>
                      {Math.round(evt.confidence * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} className="btn btn--secondary">
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => handleInspect('seminar_hall')}
            className="btn btn--primary"
          >
            Explore Highlighted Room in 3D Twin
          </button>
        </div>
      </div>
    </div>
  );
}
