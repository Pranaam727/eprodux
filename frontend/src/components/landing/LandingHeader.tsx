// ============================================================
// LandingHeader.tsx — EcoTwin Architectural Navigation Header
// ============================================================

import { IS_DEMO } from '../../services/api';
import type { FloorState } from '../../types';

interface Props {
  floorState: FloorState | null;
  onOpenUpload: () => void;
  onNavigateToDashboard: () => void;
}

export function LandingHeader({ floorState, onOpenUpload, onNavigateToDashboard }: Props) {
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
      <div className="brand">
        <div
          className="brand-logo"
          style={{
            background: 'linear-gradient(135deg, #10b981, #06b6d4)',
            boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)',
          }}
        >
          ET
        </div>
        <div>
          <div
            className="brand-name"
            style={{
              background: 'linear-gradient(90deg, #10b981, #38bdf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            EcoTwin
          </div>
          <div className="brand-subtitle">University Building Digital Twin</div>
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
          onClick={() => scrollToSection('hero-section')}
          className="tab-item"
          style={{ padding: '8px 12px', fontSize: '0.80rem' }}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('twin-section')}
          className="tab-item"
          style={{ padding: '8px 12px', fontSize: '0.80rem' }}
        >
          3D Digital Twin
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('how-it-works-section')}
          className="tab-item"
          style={{ padding: '8px 12px', fontSize: '0.80rem' }}
        >
          Pipeline
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('insights-section')}
          className="tab-item"
          style={{ padding: '8px 12px', fontSize: '0.80rem' }}
        >
          GenAI Insights
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('transparency-section')}
          className="tab-item"
          style={{ padding: '8px 12px', fontSize: '0.80rem' }}
        >
          Transparency
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
          className="btn btn--primary btn--sm"
          style={{ boxShadow: '0 0 12px rgba(16, 185, 129, 0.35)' }}
        >
          📹 Upload Video
        </button>

        <button
          type="button"
          onClick={onNavigateToDashboard}
          className="btn btn--secondary btn--sm"
          title="Open Operational Twin Dashboard"
        >
          ⚡ Operations Twin
        </button>
      </div>
    </header>
  );
}
