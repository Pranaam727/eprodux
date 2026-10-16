// ============================================================
// LandingHero.tsx — Eprodux 3D Hero Section
// ============================================================

import { DigitalTwin3D } from '../DigitalTwin3D';
import type { FloorState, RoomId } from '../../types';

interface Props {
  floorState: FloorState | null;
  selectedRoomId: RoomId | null;
  onRoomSelect: (roomId: RoomId) => void;
  onOpenUpload: () => void;
  onLaunchDashboard: () => void;
}

export function LandingHero({
  floorState,
  selectedRoomId,
  onRoomSelect,
  onOpenUpload,
  onLaunchDashboard,
}: Props) {
  return (
    <section
      id="hero-section"
      style={{
        position: 'relative',
        padding: '48px 24px 32px',
        maxWidth: 1600,
        margin: '0 auto',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(420px, 1fr) 1.25fr',
          gap: 36,
          alignItems: 'center',
        }}
        className="hero-grid"
      >
        {/* Left Column */}
        <div>
          {/* Eyebrow */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--accent-green)',
              marginBottom: 20,
              textTransform: 'uppercase',
            }}
          >
            <span className="status-dot status-dot--on status-dot--pulse" />
            AI-POWERED BUILDING SUSTAINABILITY
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: 'clamp(2.5rem, 4.5vw, 3.8rem)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: '#f8fafc',
              marginBottom: 20,
            }}
          >
            Make every building <br />
            <span
              style={{
                background: 'linear-gradient(90deg, #10b981 0%, #06b6d4 50%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              think greener.
            </span>
          </h1>

          {/* Supporting Text */}
          <p
            style={{
              fontSize: '1.05rem',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
              marginBottom: 32,
              maxWidth: 580,
            }}
          >
            Turn building video and resource data into an intelligent digital twin. Understand occupancy,
            discover energy waste, and make smarter sustainability decisions.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
            <button
              type="button"
              onClick={onLaunchDashboard}
              className="btn btn--primary"
              style={{
                padding: '12px 26px',
                fontSize: '0.94rem',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 4px 24px rgba(16, 185, 129, 0.4)',
              }}
            >
              ⚡ Launch Dashboard
            </button>

            <button
              type="button"
              onClick={onOpenUpload}
              className="btn btn--secondary"
              style={{
                padding: '12px 24px',
                fontSize: '0.94rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              📹 Upload Video
            </button>
          </div>

          {/* Privacy Note */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
              maxWidth: 580,
            }}
          >
            <span style={{ fontSize: '1rem' }}>🛡️</span>
            <span>
              Recorded video supported · No face recognition · No frame storage by Eprodux CV pipeline
            </span>
          </div>
        </div>

        {/* Right 3D Visualizer Column */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              position: 'relative',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(16, 185, 129, 0.15)',
              border: '1px solid var(--border-accent)',
            }}
          >
            <DigitalTwin3D
              floorState={floorState}
              selectedRoomId={selectedRoomId}
              onRoomSelect={onRoomSelect}
              height={500}
            />
          </div>

          {/* Floating Model Badge */}
          <div
            style={{
              position: 'absolute',
              bottom: -14,
              right: 24,
              background: 'rgba(10, 15, 30, 0.9)',
              border: '1px solid var(--border-accent)',
              borderRadius: 'var(--radius-full)',
              padding: '4px 14px',
              fontSize: '0.70rem',
              color: 'var(--accent-green)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
            }}
          >
            <span className="status-dot status-dot--on" />
            <span>Interactive 3D University Floor · 4 Canonical Rooms</span>
          </div>
        </div>
      </div>
    </section>
  );
}
