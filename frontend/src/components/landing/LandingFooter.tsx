// ============================================================
// LandingFooter.tsx — EcoTwin Architectural Footer
// ============================================================


export function LandingFooter() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        padding: '40px 24px',
        marginTop: 64,
      }}
    >
      <div
        style={{
          maxWidth: 1600,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            className="brand-logo"
            style={{
              width: 30,
              height: 30,
              fontSize: '0.8rem',
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
            }}
          >
            ET
          </div>
          <div>
            <div style={{ fontSize: '0.90rem', fontWeight: 800 }}>EcoTwin · Eprodux Project</div>
            <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
              University Building Digital Twin for Resource Management
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
          Sense → See → Twin → Think → Act
        </div>

        <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
          Built for hackathon demonstration · 4 Canonical Campus Zones
        </div>
      </div>
    </footer>
  );
}
