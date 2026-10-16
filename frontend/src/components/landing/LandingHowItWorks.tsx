// ============================================================
// LandingHowItWorks.tsx — 5-Stage Architecture Pipeline
// Sense → See → Twin → Think → Act
// ============================================================


const STAGES = [
  {
    step: '1',
    name: 'Sense',
    tag: 'Input Streams',
    icon: '📡',
    desc: 'Recorded video footage captures physical spaces. Meter readings, CO₂, and temperature inputs are modeled and ingested.',
    provenance: 'Recorded video + simulated environmental sensors',
  },
  {
    step: '2',
    name: 'See',
    tag: 'Computer Vision',
    icon: '👁️',
    desc: 'YOLOv8 detects occupants and ByteTrack estimates headcount per zone. Privacy-first: no facial recognition, no frame storage.',
    provenance: 'CV Headcount Inference',
  },
  {
    step: '3',
    name: 'Twin',
    tag: 'Digital Backend',
    icon: '🏛️',
    desc: 'Maintains canonical building state across Seminar Hall, Classroom, Lab, and Office. Correlates manual lighting and detects idle anomalies.',
    provenance: 'Single Source of Truth',
  },
  {
    step: '4',
    name: 'Think',
    tag: 'GenAI Advisory',
    icon: '🧠',
    desc: 'Claude API and RAG analyze twin summaries against sustainability guidelines. Produces prioritized action items with deterministic savings math.',
    provenance: 'Deterministic Savings + RAG Guidelines',
  },
  {
    step: '5',
    name: 'Act',
    tag: 'Interactive Control',
    icon: '⚡',
    desc: 'Facility managers review grounded recommendations, simulate what-if energy scenarios, and take proactive conservation actions.',
    provenance: 'Advisory Review & Human-in-the-Loop',
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
          ARCHITECTURE & PIPELINE
        </div>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 12 }}>
          From raw footage to sustainable building intelligence.
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto', fontSize: '0.95rem' }}>
          Five decoupled, independently testable stages turn university camera footage and telemetry into verifiable energy conservation.
        </p>
      </div>

      {/* 5 Stages Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
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

            <div style={{ fontSize: '1.75rem', marginBottom: 8 }}>{s.icon}</div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>{s.name}</h3>

            <p style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16, flex: 1 }}>
              {s.desc}
            </p>

            <div
              style={{
                fontSize: '0.68rem',
                color: 'var(--text-muted)',
                paddingTop: 8,
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
