// ============================================================
// App.tsx – EcoTwin Root Component
// Integrates 3D Landing Page, Video Upload Workflow, and
// Full Digital Twin Operational Dashboard.
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  FloorState,
  Alert,
  Recommendation,
  RoomId,
  EnergyDataPoint,
  OccupancyDataPoint,
  VideoAnalysisResult,
} from './types';
import {
  fetchFloorState,
  fetchAlerts,
  fetchRecommendations,
  fetchEnergyHistory,
  fetchOccupancyHistory,
  acceptRecommendation,
  dismissRecommendation,
  connectWebSocket,
  IS_DEMO,
} from './services/api';

import { AppHeader } from './components/AppHeader';
import { KPICards } from './components/KPICards';
import { FloorPlan } from './components/FloorPlan';
import { RoomDetailPanel } from './components/RoomDetailPanel';
import { AlertPanel } from './components/AlertPanel';
import { RecommendationPanel } from './components/RecommendationPanel';
import { WhatIfSimulator } from './components/WhatIfSimulator';
import { AnalyticsChart } from './components/AnalyticsChart';
import { ChatAssistant } from './components/ChatAssistant';

// Landing Page Components
import { LandingHeader } from './components/landing/LandingHeader';
import { LandingHero } from './components/landing/LandingHero';
import { LandingHowItWorks } from './components/landing/LandingHowItWorks';
import { LandingFourRooms } from './components/landing/LandingFourRooms';
import { LandingInsights } from './components/landing/LandingInsights';
import { LandingTechStack } from './components/landing/LandingTechStack';
import { LandingTransparency } from './components/landing/LandingTransparency';
import { LandingFooter } from './components/landing/LandingFooter';

// Video Modals
import { VideoUploadModal } from './components/VideoUploadModal';
import { AnalysisResultsModal } from './components/AnalysisResultsModal';

// ---------------------------------------------------------------
// Toast notification system
// ---------------------------------------------------------------
interface Toast {
  id: string;
  type: 'success' | 'info' | 'warning';
  message: string;
}

let toastCounter = 0;
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = `toast-${Date.now()}-${toastCounter++}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  return { toasts, show };
}

// ---------------------------------------------------------------
// Main App Component
// ---------------------------------------------------------------
export default function App() {
  const [activeTab, setActiveTab] = useState<'landing' | 'overview' | 'simulator' | 'charts' | 'assistant'>('landing');
  const [floorState, setFloorState] = useState<FloorState | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [energyHistory, setEnergyHistory] = useState<EnergyDataPoint[]>([]);
  const [occupancyHistory, setOccupancyHistory] = useState<OccupancyDataPoint[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<RoomId | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toISOString());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Video Upload & Analysis Modal States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResult | null>(null);

  const { toasts, show: showToast } = useToasts();
  const wsCleanupRef = useRef<(() => void) | null>(null);

  // ---------------------------------------------------------------
  // Initial data load
  // ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [floor, alts, recs, eh, oh] = await Promise.all([
          fetchFloorState(),
          fetchAlerts(),
          fetchRecommendations(),
          fetchEnergyHistory(),
          fetchOccupancyHistory(),
        ]);
        if (cancelled) return;
        setFloorState(floor);
        setAlerts(alts);
        setRecommendations(recs);
        setEnergyHistory(eh);
        setOccupancyHistory(oh);
        setLastUpdate(new Date().toISOString());
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError('Failed to load dashboard data. Using demo data if available.');
        console.error('[eprodux] Load error:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------
  // WebSocket – live push (no-op in demo mode)
  // ---------------------------------------------------------------
  useEffect(() => {
    if (IS_DEMO) return;

    const cleanup = connectWebSocket(
      (update) => {
        setFloorState((prev) => (prev ? { ...prev, ...update } : null));
        setLastUpdate(new Date().toISOString());
      },
      (status) => {
        if (status === 'disconnected') {
          showToast('WebSocket disconnected – attempting reconnect', 'warning');
        }
      },
    );
    wsCleanupRef.current = cleanup;
    return () => cleanup();
  }, [showToast]);

  // ---------------------------------------------------------------
  // Recommendation accept / dismiss
  // ---------------------------------------------------------------
  const handleAccept = useCallback(
    async (id: string) => {
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'accepted' } : r)),
      );
      showToast('Recommendation accepted for review. No physical device was changed.', 'success');
      await acceptRecommendation(id);
    },
    [showToast],
  );

  const handleDismiss = useCallback(
    async (id: string) => {
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'dismissed' } : r)),
      );
      showToast('Recommendation dismissed.', 'info');
      await dismissRecommendation(id);
    },
    [showToast],
  );

  // ---------------------------------------------------------------
  // Video Analysis Handlers
  // ---------------------------------------------------------------
  const handleAnalysisComplete = useCallback((result: VideoAnalysisResult) => {
    setAnalysisResult(result);
    setIsResultsModalOpen(true);
    showToast(`Video analysis finished: ${result.fileName}`, 'success');

    // Optionally reflect observation into local floorState if relevant
    setFloorState((prev) => {
      if (!prev) return prev;
      const updatedRooms = { ...prev.rooms };
      Object.entries(result.observations).forEach(([roomId, obs]) => {
        const id = roomId as RoomId;
        if (updatedRooms[id]) {
          updatedRooms[id] = {
            ...updatedRooms[id],
            occupancy: obs.currentOccupancy,
            confidence: obs.confidence,
            lastUpdated: obs.freshnessIso,
          };
        }
      });
      return {
        ...prev,
        rooms: updatedRooms,
      };
    });
  }, [showToast]);

  const handleInspectRoomFromResults = useCallback((roomId: RoomId) => {
    setSelectedRoomId(roomId);
    setIsResultsModalOpen(false);
    // Smooth scroll to 3D canvas or rooms section
    const el = document.getElementById('hero-section') || document.getElementById('twin-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ---------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------
  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const potentialSavingsKwh = recommendations
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + r.estimatedEnergySavedKwh, 0);

  const selectedRoom = selectedRoomId && floorState ? floorState.rooms[selectedRoomId] : null;

  // ---------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="app-layout">
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div className="brand-logo" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
              ET
            </div>
            <div className="brand-name" style={{ background: 'linear-gradient(90deg, #10b981, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              EcoTwin
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="loading-shimmer" style={{ height: 90 }} />
            ))}
          </div>
          <div className="loading-shimmer" style={{ height: 360, marginTop: 16 }} />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <div className="app-layout">
      {/* Dynamic Header based on active tab */}
      {activeTab === 'landing' ? (
        <LandingHeader
          floorState={floorState}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          onNavigateToDashboard={() => setActiveTab('overview')}
        />
      ) : (
        <AppHeader
          floorState={floorState}
          lastUpdate={lastUpdate}
          activeTab={activeTab}
          onTabChange={(tab: any) => setActiveTab(tab)}
          onOpenUpload={() => setIsUploadModalOpen(true)}
        />
      )}

      {loadError && (
        <div
          style={{
            margin: '8px 16px 0',
            padding: '8px 16px',
            background: 'var(--alert-warning-bg)',
            borderRadius: 8,
            border: '1px solid rgba(245,158,11,0.3)',
            fontSize: '0.75rem',
            color: 'var(--alert-warning)',
          }}
          role="alert"
        >
          ⚠️ {loadError}
        </div>
      )}

      {/* ── 3D LANDING PAGE VIEW ── */}
      {activeTab === 'landing' && (
        <main role="main">
          <LandingHero
            floorState={floorState}
            selectedRoomId={selectedRoomId}
            onRoomSelect={(id) => setSelectedRoomId((prev) => (prev === id ? null : id))}
            onOpenUpload={() => setIsUploadModalOpen(true)}
            onExploreTwin={() => {
              const el = document.getElementById('twin-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          {/* Selected Room Details Drawer when room is clicked in 3D scene */}
          {selectedRoom && (
            <div style={{ maxWidth: 1600, margin: '0 auto 24px', padding: '0 24px' }}>
              <RoomDetailPanel
                room={selectedRoom}
                alerts={alerts}
                recommendations={recommendations}
                onClose={() => setSelectedRoomId(null)}
              />
            </div>
          )}

          {/* Sustainability KPI Cards Row */}
          <div style={{ maxWidth: 1600, margin: '0 auto', padding: '0 24px' }}>
            <KPICards
              floorState={floorState}
              activeAlerts={activeAlerts}
              potentialSavingsKwh={potentialSavingsKwh}
            />
          </div>

          <LandingHowItWorks />

          <LandingFourRooms
            floorState={floorState}
            selectedRoomId={selectedRoomId}
            onRoomSelect={(id) => {
              setSelectedRoomId(id);
              const el = document.getElementById('hero-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          <LandingInsights
            recommendations={recommendations}
            onAccept={handleAccept}
            onDismiss={handleDismiss}
            onExploreInsights={() => setActiveTab('assistant')}
          />

          <LandingTechStack />

          <LandingTransparency />

          <LandingFooter />
        </main>
      )}

      {/* ── OPERATIONS TWIN / OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <main className="main-content" role="main">
          {/* Left column */}
          <div>
            <KPICards
              floorState={floorState}
              activeAlerts={activeAlerts}
              potentialSavingsKwh={potentialSavingsKwh}
            />

            <FloorPlan
              floorState={floorState}
              selectedRoomId={selectedRoomId}
              onRoomSelect={(id) => setSelectedRoomId((prev) => (prev === id ? null : id))}
            />

            {selectedRoom && (
              <div style={{ marginTop: 16 }}>
                <RoomDetailPanel
                  room={selectedRoom}
                  alerts={alerts}
                  recommendations={recommendations}
                  onClose={() => setSelectedRoomId(null)}
                />
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <AlertPanel alerts={alerts} />
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="card">
                <RecommendationPanel
                  recommendations={recommendations}
                  onAccept={handleAccept}
                  onDismiss={handleDismiss}
                />
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="sidebar">
            {/* Quick Upload Video Widget */}
            <div className="card card--compact" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(6,182,212,0.05))', border: '1px solid var(--border-accent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: '1.4rem' }}>📹</span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Upload Video Footage</div>
                  <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>Analyze room occupancy with YOLOv8</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="btn btn--primary btn--sm w-full"
                style={{ justifyContent: 'center' }}
              >
                Launch Video Analysis
              </button>
            </div>

            {/* Pipeline status card */}
            <div className="card card--compact">
              <div className="section-title" style={{ marginBottom: 12 }}>
                Pipeline Status
              </div>
              {([
                {
                  step: 'Sense',
                  desc: 'Camera & meter events',
                  status: floorState?.connectionState === 'connected' ? 'on' : 'offline',
                },
                { step: 'See', desc: 'CV occupancy estimation', status: 'on' },
                { step: 'Twin', desc: 'Digital room state', status: 'on' },
                { step: 'Think', desc: 'GenAI recommendations', status: IS_DEMO ? 'unknown' : 'on' },
                { step: 'Act', desc: 'Human review & what-if', status: 'on' },
              ] as const).map((item, i) => (
                <div
                  key={item.step}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 0',
                    borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background:
                        item.status === 'on'
                          ? 'var(--accent-green-bg)'
                          : item.status === 'offline'
                          ? 'var(--alert-critical-bg)'
                          : 'rgba(245,158,11,0.1)',
                      border: `1px solid ${
                        item.status === 'on'
                          ? 'var(--accent-green)'
                          : item.status === 'offline'
                          ? 'var(--alert-critical)'
                          : 'var(--alert-warning)'
                      }`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.70rem',
                      fontWeight: 700,
                      color:
                        item.status === 'on'
                          ? 'var(--accent-green)'
                          : item.status === 'offline'
                          ? 'var(--alert-critical)'
                          : 'var(--alert-warning)',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{item.step}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span
                      className={`status-dot status-dot--${item.status}${
                        item.status === 'on' ? ' status-dot--pulse' : ''
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Mode explanation */}
            {IS_DEMO && (
              <div className="card card--compact">
                <div className="demo-banner" style={{ borderRadius: 8 }}>
                  <span>⚗️</span>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Demo Mode Active</div>
                    <div style={{ fontWeight: 400 }}>
                      All data on this dashboard is <strong>simulated</strong> for demonstration.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick room status list */}
            {floorState && (
              <div className="card card--compact">
                <div className="section-title" style={{ marginBottom: 12 }}>
                  Room Status
                </div>
                {(Object.values(floorState.rooms) as import('./types').RoomState[]).map((room) => (
                  <button
                    key={room.id}
                    id={`room-btn-${room.id}`}
                    onClick={() => {
                      setSelectedRoomId(room.id);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                    aria-label={`View ${room.name} details`}
                  >
                    <span
                      className={`status-dot status-dot--${
                        room.connectionState === 'offline'
                          ? 'offline'
                          : room.lightState === 'ON'
                          ? 'on'
                          : 'off'
                      }`}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {room.name}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {room.occupancy != null ? `${room.occupancy} occupants` : 'Occupancy UNKNOWN'} ·{' '}
                        {room.lightState} (manual)
                      </div>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* ── SIMULATOR TAB ── */}
      {activeTab === 'simulator' && (
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: 16, width: '100%' }} role="main">
          <div className="card">
            <WhatIfSimulator />
          </div>
        </main>
      )}

      {/* ── ANALYTICS TAB ── */}
      {activeTab === 'charts' && (
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: 16, width: '100%' }} role="main">
          <AnalyticsChart energyHistory={energyHistory} occupancyHistory={occupancyHistory} />
          <div style={{ marginTop: 16 }}>
            <div className="card">
              <RecommendationPanel
                recommendations={recommendations}
                onAccept={handleAccept}
                onDismiss={handleDismiss}
              />
            </div>
          </div>
        </main>
      )}

      {/* ── ASSISTANT TAB ── */}
      {activeTab === 'assistant' && (
        <main style={{ maxWidth: 900, margin: '0 auto', padding: 16, width: '100%' }} role="main">
          <div className="card">
            <ChatAssistant />
          </div>
        </main>
      )}

      {/* Video Upload Modal */}
      <VideoUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onAnalysisComplete={handleAnalysisComplete}
      />

      {/* Video Analysis Results Modal */}
      <AnalysisResultsModal
        result={analysisResult}
        isOpen={isResultsModalOpen}
        onClose={() => setIsResultsModalOpen(false)}
        onInspectRoom={handleInspectRoomFromResults}
      />

      {/* Toast container */}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
