// ============================================================
// LandingFinalCta.tsx — Eprodux Final Call-To-Action Banner
// ============================================================

interface Props {
  onLaunchDashboard: () => void;
  onOpenUpload: () => void;
}

export function LandingFinalCta({ onLaunchDashboard, onOpenUpload }: Props) {
  return (
    <section
      style={{
        padding: '64px 24px 80px',
        maxWidth: 1600,
        margin: '0 auto',
        width: '100%',
      }}
    >
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.06), rgba(15, 23, 42, 0.9))',
          border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius-xl)',
          padding: '48px 32px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(16, 185, 129, 0.15)',
        }}
      >
        <span className="badge badge--green" style={{ marginBottom: 16 }}>
          ⚡ READY TO DEPLOY
        </span>

        <h2
          style={{
            fontSize: 'clamp(2rem, 3.8vw, 3rem)',
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: 16,
            color: '#f8fafc',
          }}
        >
          Make your university floor <br />
          <span
            style={{
              background: 'linear-gradient(90deg, #10b981, #38bdf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            smarter and more sustainable.
          </span>
        </h2>

        <p
          style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            maxWidth: 620,
            margin: '0 auto 32px',
            lineHeight: 1.6,
          }}
        >
          Gain actionable insights into room occupancy, eliminate lighting waste, and quantify cost and carbon reductions in real-time.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onLaunchDashboard}
            className="btn btn--primary"
            style={{
              padding: '14px 32px',
              fontSize: '1rem',
              fontWeight: 700,
              boxShadow: '0 4px 24px rgba(16, 185, 129, 0.45)',
            }}
          >
            Start Optimizing Your Building
          </button>

          <button
            type="button"
            onClick={onOpenUpload}
            className="btn btn--secondary"
            style={{
              padding: '14px 28px',
              fontSize: '1rem',
            }}
          >
            📹 Upload Footage
          </button>
        </div>
      </div>
    </section>
  );
}
