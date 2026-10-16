// ============================================================
// LandingFooter.tsx — Eprodux Architectural Footer
// ============================================================

export function LandingFooter() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        padding: '48px 24px 36px',
        marginTop: 64,
      }}
    >
      <div
        style={{
          maxWidth: 1600,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 32,
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div
              className="brand-logo"
              style={{
                width: 32,
                height: 32,
                fontSize: '0.85rem',
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              }}
            >
              EP
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800 }}>Eprodux</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                University Building Digital Twin
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Make every building think greener. Eprodux combines computer vision occupancy tracking with digital twin simulations to uncover energy waste and generate grounded sustainability recommendations.
          </p>
        </div>

        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, color: 'var(--text-primary)' }}>
            Architecture Pipeline
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>1. Sense — Recorded video & simulated telemetry</li>
            <li>2. See — YOLOv8 & ByteTrack zone headcounts</li>
            <li>3. Twin — Canonical floor state & anomaly engine</li>
            <li>4. Think — Anthropic Claude API & RAG guidance</li>
            <li>5. Act — Sustainable human-in-the-loop decisions</li>
          </ul>
        </div>

        <div style={{ maxWidth: 360 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, color: 'var(--text-primary)' }}>
            Limitations & Transparency Note
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            Demonstration mode utilizes simulated power meters and ambient sensors. Lighting states are manually supplied or simulated (not derived from CV). Modeled financial (₹) and carbon reductions are illustrative projections based on standard university tariffs.
          </p>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1600,
          margin: '32px auto 0',
          paddingTop: 20,
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.70rem',
          color: 'var(--text-muted)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <span>© 2026 Eprodux · Hackathon Demonstration Platform</span>
        <span>Four Monitored Campus Zones: Seminar Hall · Classroom · Laboratory · Office</span>
      </div>
    </footer>
  );
}
