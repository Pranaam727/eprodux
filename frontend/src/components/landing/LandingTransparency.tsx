// ============================================================
// LandingTransparency.tsx — Limitations & Transparency Disclosures
// Front-and-center disclosures on data provenance & simulation.
// ============================================================


const DISCLOSURES = [
  {
    icon: '📹',
    title: 'Recorded Video Input',
    text: 'Recorded university campus footage is the primary input for the CV pipeline during demonstrations. Live camera connectivity is supported as an optional deployment enhancement.',
  },
  {
    icon: '💡',
    title: 'Lighting State Provenance',
    text: 'Lighting states (ON / OFF / UNKNOWN) are manually supplied by operators or simulated by the digital twin. Lighting is not automatically inferred from camera computer vision.',
  },
  {
    icon: '📊',
    title: 'Simulated Environmental Sensors',
    text: 'Power meter readings, ambient CO₂ ppm, and temperature measurements are simulated inputs labeled as such across all API contracts and dashboards.',
  },
  {
    icon: '📐',
    title: 'Modeled Savings Estimates',
    text: 'Energy (kWh), financial (₹), and emissions (kg CO₂) reductions are deterministic mathematical projections based on published equipment wattage and standard tariffs, not guaranteed reductions.',
  },
  {
    icon: '🛡️',
    title: 'Advisory Recommendations Only',
    text: 'EcoTwin functions strictly as an advisory intelligence layer. The system produces recommendations for facility managers but does not directly control physical building relays or HVAC hardware.',
  },
  {
    icon: '🔒',
    title: 'Privacy & Identity Protection',
    text: 'The computer vision pipeline implements zero face recognition and zero identity profiling. Video frames are processed in-memory to extract bounding boxes; raw frames are never stored.',
  },
];

export function LandingTransparency() {
  return (
    <section
      id="transparency-section"
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
            color: 'var(--accent-blue)',
            marginBottom: 8,
          }}
        >
          ETHICAL AI & HONEST ENGINEERING
        </div>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 12 }}>
          Operational Boundaries & Transparency
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto', fontSize: '0.90rem' }}>
          We believe sustainable digital twins must be transparent about data origins, modeling assumptions, and system boundaries.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {DISCLOSURES.map((item) => (
          <div
            key={item.title}
            className="card card--compact"
            style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: 14,
              padding: 20,
            }}
          >
            <div style={{ fontSize: '1.6rem', flexShrink: 0 }}>{item.icon}</div>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 6 }}>{item.title}</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {item.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
