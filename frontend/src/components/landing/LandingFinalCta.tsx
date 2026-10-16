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
          background: 'linear-gradient(135deg, #073D91 0%, #0645A5 50%, #05051A 100%)',
          border: '1px solid rgba(0, 184, 217, 0.4)',
          borderRadius: 'var(--radius-xl)',
          padding: '54px 32px',
          textAlign: 'center',
          boxShadow: '0 24px 64px rgba(3, 9, 31, 0.7), 0 0 32px rgba(6, 69, 165, 0.35)',
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
            color: '#F7FAFF',
          }}
        >
          Make your university floor <br />
          <span
            style={{
              color: '#A3D900',
              textShadow: '0 0 24px rgba(163, 217, 0, 0.4)',
            }}
          >
            smarter and more sustainable.
          </span>
        </h2>

        <p
          style={{
            fontSize: '1rem',
            color: '#A8B4CC',
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
