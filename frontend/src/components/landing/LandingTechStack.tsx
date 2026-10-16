// ============================================================
// LandingTechStack.tsx — Eprodux Full Technology Ecosystem
// ============================================================


const TECH_ITEMS = [
  {
    category: 'Computer Vision',
    tech: 'YOLOv8 + ByteTrack',
    desc: 'Python & OpenCV pipeline for real-time person detection and multi-object trajectory tracking.',
  },
  {
    category: 'Digital Twin Backend',
    tech: 'FastAPI + WebSockets',
    desc: 'High-concurrency Python state engine managing canonical room models, camera health, and live streams.',
  },
  {
    category: 'Generative AI & RAG',
    tech: 'Anthropic Claude + ChromaDB',
    desc: 'Grounded sustainability advisory with deterministic savings mathematics and retrieved energy codes.',
  },
  {
    category: '3D Architectural Twin',
    tech: 'Three.js + WebGL',
    desc: 'Custom interactive 3D university floor model with cutaway architectural view and dynamic lighting.',
  },
  {
    category: 'Frontend Platform',
    tech: 'React 19 + TypeScript + Vite',
    desc: 'Modern, high-performance user interface with zero runtime CSS overhead and dark glassmorphic styling.',
  },
  {
    category: 'Containerization',
    tech: 'Docker Compose',
    desc: 'Production-ready orchestration uniting CV, Twin, GenAI, and Frontend services in isolated environments.',
  },
];

export function LandingTechStack() {
  return (
    <section
      id="tech-stack-section"
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
          ENGINEERED FOR SCALE
        </div>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 12 }}>
          Technology Architecture
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto', fontSize: '0.90rem' }}>
          Built upon modern, production-grade tools designed for real-time edge processing and university deployment.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {TECH_ITEMS.map((item) => (
          <div
            key={item.category}
            className="card card--compact"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
            }}
          >
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: 6 }}>
              {item.category}
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 6 }}>
              {item.tech}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
