// ============================================================
// LandingFeatures.tsx — Eprodux Core Platform Features
// Computer Vision, Digital Twin, AI Recommendations, Sustainability Analytics
// ============================================================

const FEATURES = [
  {
    icon: '👁️',
    title: 'Computer Vision Occupancy',
    tag: 'Edge Inference',
    description:
      'Processes recorded video streams using YOLOv8 & ByteTrack to count occupants per room accurately without storing facial data or individual identities.',
    metrics: ['Privacy-Preserving', 'Zone Headcounts', 'Trajectory Correlation'],
  },
  {
    icon: '🏛️',
    title: '3D University Digital Twin',
    tag: 'Single Source of Truth',
    description:
      'Visualizes university spaces in real-time. Correlates manual lighting states, tracks camera health, and maps environmental sensors across 4 canonical rooms.',
    metrics: ['Interactive Three.js', 'Idle Waste Detection', 'Live WebSocket Push'],
  },
  {
    icon: '🧠',
    title: 'AI Recommendations',
    tag: 'GenAI & RAG',
    description:
      'Synthesizes building telemetry with retrieved sustainability guidelines. Provides facility managers with grounded action plans and deterministic savings math.',
    metrics: ['Deterministic Savings', 'Claude API Integration', 'Audit Trail Logging'],
  },
  {
    icon: '📊',
    title: 'Sustainability Analytics',
    tag: 'Energy Intelligence',
    description:
      'Translates occupancy anomalies into modeled kilowatt-hour reductions, financial savings (₹), and avoided CO₂ emissions with documented assumptions.',
    metrics: ['Cost Savings (₹/kWh)', 'Carbon Emissions Offset', 'What-If Simulations'],
  },
];

export function LandingFeatures() {
  return (
    <section
      id="features-section"
      style={{
        padding: '64px 24px',
        maxWidth: 1600,
        margin: '0 auto',
        width: '100%',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
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
          CORE PLATFORM CAPABILITIES
        </div>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 12 }}>
          Everything needed to optimize university resources.
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto', fontSize: '0.90rem' }}>
          Four decoupled, synchronized systems delivering transparency and verifiable energy reductions.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}
      >
        {FEATURES.map((feat) => (
          <div
            key={feat.title}
            className="card"
            style={{
              background: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              padding: 24,
              border: '1px solid var(--border-card)',
              transition: 'transform 0.2s ease, border-color 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: '2rem' }}>{feat.icon}</span>
              <span className="badge badge--gray">{feat.tag}</span>
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 10 }}>{feat.title}</h3>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20, flex: 1 }}>
              {feat.description}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              {feat.metrics.map((m) => (
                <span
                  key={m}
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--color-accent)',
                    background: 'rgba(0, 184, 217, 0.10)',
                    border: '1px solid rgba(0, 184, 217, 0.25)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  ✓ {m}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
