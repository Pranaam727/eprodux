// ============================================================
// LandingHowItWorks.tsx — 4-Stage Operational Workflow
// Upload Video → Analyze Occupancy → Build Digital Twin → Generate Recommendations
// ============================================================

const STAGES = [
  {
    step: '1',
    name: 'Upload Video',
    tag: 'Input Footage',
    icon: '📹',
    desc: 'Upload recorded university hallway or room footage (MP4, MOV, AVI). Video remains local to the processing pipeline with no raw frames persisted.',
    provenance: 'Recorded video source · No face storage',
  },
  {
    step: '2',
    name: 'Analyze Occupancy',
    tag: 'CV Inference',
    icon: '👁️',
    desc: 'The YOLOv8 + ByteTrack pipeline processes footage at up to 30 FPS, generating timestamped headcount events across monitored campus zones.',
    provenance: 'Edge Headcount Inference',
  },
  {
    step: '3',
    name: 'Build Digital Twin',
    tag: 'Spatial State',
    icon: '🏛️',
    desc: 'In-memory state engine correlates headcount with lighting states (ON/OFF/UNKNOWN) and simulates power meter and CO₂ readings.',
    provenance: 'Centralized Digital Twin Model',
  },
  {
    step: '4',
    name: 'Generate Recommendations',
    tag: 'GenAI & Math',
    icon: '🧠',
    desc: 'Claude API and RAG analyze twin summaries against sustainability guidelines, producing verified actions with deterministic savings calculations.',
    provenance: 'Deterministic Savings (₹, kWh, CO₂)',
  },
];

export function LandingHowItWorks() {
  return (
    <section
      id="how-it-works-section"
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
          STEP-BY-STEP WORKFLOW
        </div>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 12 }}>
          How Eprodux works.
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto', fontSize: '0.90rem' }}>
          From raw campus footage to verified, audit-ready energy conservation recommendations.
        </p>
      </div>

      {/* 4 Stages Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20,
          position: 'relative',
        }}
      >
        {STAGES.map((s) => (
          <div
            key={s.name}
            className="card"
            style={{
              background: 'var(--bg-card)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              padding: 24,
              border: '1px solid var(--border-card)',
            }}
          >
            {/* Step badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'var(--accent-green-bg)',
                  border: '1px solid var(--accent-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: 'var(--accent-green)',
                }}
              >
                {s.step}
              </div>
              <span className="badge badge--gray">{s.tag}</span>
            </div>

            <div style={{ fontSize: '2rem', marginBottom: 8 }}>{s.icon}</div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>{s.name}</h3>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 16, flex: 1 }}>
              {s.desc}
            </p>

            <div
              style={{
                fontSize: '0.68rem',
                color: 'var(--text-muted)',
                paddingTop: 10,
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <strong>Data Provenance:</strong> {s.provenance}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
