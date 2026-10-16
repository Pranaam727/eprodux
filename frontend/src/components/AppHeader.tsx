// ============================================================
// AppHeader – top navigation bar with branding and status
// ============================================================

import type { FloorState } from '../types';
import { IS_DEMO } from '../services/api';

interface Props {
  floorState: FloorState | null;
  lastUpdate: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenUpload?: () => void;
}

const TABS = [
  { id: 'landing',    label: '🌐 3D Landing' },
  { id: 'overview',   label: '🏢 Operations Twin' },
  { id: 'simulator',  label: '⚡ What-If Simulator' },
  { id: 'charts',     label: '📊 Analytics' },
  { id: 'assistant',  label: '🤖 AI Assistant' },
];

export function AppHeader({ floorState, lastUpdate, activeTab, onTabChange, onOpenUpload }: Props) {
  const isConnected = floorState?.connectionState === 'connected';

  return (
    <header className="app-header">
      <div className="brand" onClick={() => onTabChange('landing')} style={{ cursor: 'pointer' }}>
        <div className="brand-logo" aria-hidden="true" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>ET</div>
        <div>
          <div className="brand-name" style={{ background: 'linear-gradient(90deg, #10b981, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EcoTwin</div>
          <div className="brand-subtitle">
            {floorState
              ? `${floorState.buildingName} · ${floorState.floorName}`
              : 'University Building Digital Twin'}
          </div>
        </div>
      </div>

      <nav className="tab-bar" style={{ marginBottom: 0, borderBottom: 'none', flex: 1, marginLeft: 24 }}
           role="navigation" aria-label="Main navigation">
        {TABS.map(t => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            className={`tab-item${activeTab === t.id ? ' tab-item--active' : ''}`}
            onClick={() => onTabChange(t.id)}
            aria-selected={activeTab === t.id}
            role="tab"
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="header-meta">
        {onOpenUpload && (
          <button
            type="button"
            onClick={onOpenUpload}
            className="btn btn--primary btn--sm"
            style={{ marginRight: 8 }}
          >
            📹 Upload Video
          </button>
        )}
        {IS_DEMO && (
          <span className="badge badge--demo">⚗️ DEMO MODE</span>
        )}
        <span className="flex items-center gap-2">
          <span
            className={`status-dot status-dot--${isConnected ? 'on' : 'offline'}${isConnected ? ' status-dot--pulse' : ''}`}
            aria-label={isConnected ? 'Connected' : 'Offline'}
          />
          <span className="text-xs">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </span>
        <span className="text-xs text-muted">
          Updated {formatRelative(lastUpdate)}
        </span>
      </div>
    </header>
  );
}

function formatRelative(iso: string): string {
  if (!iso) return '—';
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}
