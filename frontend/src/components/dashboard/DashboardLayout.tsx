// ============================================================
// DashboardLayout.tsx — Eprodux Enterprise Dashboard Shell
// Persistent sidebar, status top bar, and responsive page container.
// ============================================================

import React from 'react';
import { IS_DEMO } from '../../services/api';
import type { FloorState } from '../../types';

export type DashboardPage =
  | 'overview'
  | 'twin'
  | 'video'
  | 'energy'
  | 'recommendations'
  | 'reports'
  | 'settings';

interface Props {
  currentPage: DashboardPage;
  onPageChange: (page: DashboardPage) => void;
  onBackToLanding: () => void;
  onOpenUpload: () => void;
  floorState: FloorState | null;
  lastUpdate: string;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: DashboardPage; label: string; icon: string }[] = [
  { id: 'overview',        label: 'Overview',            icon: '📊' },
  { id: 'twin',            label: 'Digital Twin',        icon: '🏛️' },
  { id: 'video',           label: 'Video Analysis',      icon: '📹' },
  { id: 'energy',          label: 'Energy & Resources',  icon: '⚡' },
  { id: 'recommendations', label: 'AI Recommendations',  icon: '🧠' },
  { id: 'reports',         label: 'Reports & Audits',    icon: '📑' },
  { id: 'settings',        label: 'Settings',            icon: '⚙️' },
];

export function DashboardLayout({
  currentPage,
  onPageChange,
  onBackToLanding,
  onOpenUpload,
  floorState,
  lastUpdate,
  children,
}: Props) {
  const isConnected = floorState?.connectionState === 'connected';

  const formatRelative = (iso: string): string => {
    if (!iso) return '—';
    const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.round(minutes / 60)}h ago`;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* ── PERSISTENT LEFT SIDEBAR ── */}
      <aside
        style={{
          width: 260,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
          }}
          onClick={onBackToLanding}
          title="Return to Landing Page"
        >
          <div
            className="brand-logo"
            style={{
              width: 34,
              height: 34,
              fontSize: '0.9rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
              color: 'var(--color-bg)',
            }}
          >
            EP
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>Eprodux</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
              Sustainability Twin
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPageChange(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--color-card-elevated)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--color-border)' : 'transparent'}`,
                  borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                  color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Upload Video Callout Button */}
        <div style={{ padding: '0 16px 16px' }}>
          <button
            type="button"
            onClick={onOpenUpload}
            className="btn btn--primary btn--sm w-full"
            style={{ justifyContent: 'center', padding: '10px' }}
          >
            📹 Upload Footage
          </button>
        </div>

        {/* Sidebar Footer */}
        <div
          style={{
            padding: 16,
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onBackToLanding}
            className="btn btn--secondary btn--sm w-full"
            style={{ justifyContent: 'center' }}
          >
            ← Public Landing Page
          </button>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Eprodux Twin v0.1.0 · University Floor 3
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: 60,
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          {/* Breadcrumb / Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Dashboard</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'capitalize' }}>
              {NAV_ITEMS.find((n) => n.id === currentPage)?.label || currentPage}
            </span>
          </div>

          {/* Right Status Meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {IS_DEMO ? (
              <span className="badge badge--demo">⚗️ DEMO MODE</span>
            ) : (
              <span className="badge badge--green">
                <span
                  className={`status-dot status-dot--${isConnected ? 'on' : 'offline'}${
                    isConnected ? ' status-dot--pulse' : ''
                  }`}
                />
                {isConnected ? 'LIVE BACKEND' : 'OFFLINE'}
              </span>
            )}

            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Updated {formatRelative(lastUpdate)}
            </span>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main style={{ flex: 1, padding: 24, maxWidth: 1600, width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
