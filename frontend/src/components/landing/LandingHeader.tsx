// ============================================================
// LandingHeader.tsx — Eprodux Top Navigation Bar
// ============================================================

import { IS_DEMO } from '../../services/api';
import type { FloorState } from '../../types';

interface Props {
  floorState: FloorState | null;
  onOpenUpload: () => void;
  onLaunchDashboard: () => void;
}

export function LandingHeader({ floorState, onOpenUpload, onLaunchDashboard }: Props) {
  const isConnected = floorState?.connectionState === 'connected';

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      {/* Brand */}
      <div className="brand" onClick={() => scrollToSection('hero-section')} style={{ cursor: 'pointer' }}>
        <div
          className="brand-logo"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            color: 'var(--color-bg)',
            fontWeight: 800,
            boxShadow: '0 0 16px rgba(163, 217, 0, 0.4)',
          }}
        >
          EP
        </div>
        <div>
          <div
            className="brand-name"
            style={{
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Eprodux
          </div>
          <div className="brand-subtitle">Make every building think greener.</div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav
        style={{
          display: 'flex',
          gap: 20,
          alignItems: 'center',
          marginLeft: 32,
          marginRight: 'auto',
        }}
        className="nav-links"
      >
        <button
          type="button"
          onClick={() => scrollToSection('features-section')}
          className="tab-item"
          style={{ padding: '8px 12px', fontSize: '0.80rem' }}
        >
          Features
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('how-it-works-section')}
          className="tab-item"
          style={{ padding: '8px 12px', fontSize: '0.80rem' }}
        >
          How It Works
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('twin-section')}
          className="tab-item"
          style={{ padding: '8px 12px', fontSize: '0.80rem' }}
        >
          Digital Twin
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('insights-section')}
          className="tab-item"
          style={{ padding: '8px 12px', fontSize: '0.80rem' }}
        >
          Sustainability
        </button>
      </nav>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {IS_DEMO ? (
          <span className="badge badge--demo">⚗️ DEMO MODE</span>
        ) : (
          <span className="badge badge--green">
            <span
              className={`status-dot status-dot--${isConnected ? 'on' : 'offline'}${isConnected ? ' status-dot--pulse' : ''}`}
            />
            {isConnected ? 'LIVE TWIN' : 'OFFLINE'}
          </span>
        )}

        <button
          type="button"
          onClick={onOpenUpload}
          className="btn btn--secondary btn--sm"
        >
          📹 Upload Video
        </button>

        <button
          type="button"
          onClick={onLaunchDashboard}
          className="btn btn--primary btn--sm"
          style={{ boxShadow: '0 0 16px rgba(163, 217, 0, 0.45)' }}
        >
          ⚡ Launch Dashboard
        </button>
      </div>
    </header>
  );
}
