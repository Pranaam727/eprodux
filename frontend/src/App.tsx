// ============================================================
// App.tsx — Eprodux Root Application
// 1. Premium Interactive 3D Landing Page
// 2. Video Upload & CV Analysis Workflow
// 3. Full Sustainability Dashboard Suite (7 Pages)
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

// Landing Page Components
import { LandingHeader } from './components/landing/LandingHeader';
import { LandingHero } from './components/landing/LandingHero';
import { LandingFeatures } from './components/landing/LandingFeatures';
import { LandingHowItWorks } from './components/landing/LandingHowItWorks';
import { LandingFourRooms } from './components/landing/LandingFourRooms';
import { LandingInsights } from './components/landing/LandingInsights';
import { LandingFinalCta } from './components/landing/LandingFinalCta';
import { LandingTransparency } from './components/landing/LandingTransparency';
import { LandingFooter } from './components/landing/LandingFooter';

// Video Modals
import { VideoUploadModal } from './components/VideoUploadModal';
import { AnalysisResultsModal } from './components/AnalysisResultsModal';

// Dashboard Components
import { DashboardLayout, type DashboardPage } from './components/dashboard/DashboardLayout';
import { OverviewPage } from './components/dashboard/OverviewPage';
import { DigitalTwinPage } from './components/dashboard/DigitalTwinPage';
import { VideoAnalysisPage } from './components/dashboard/VideoAnalysisPage';
import { EnergyPage } from './components/dashboard/EnergyPage';
import { RecommendationsPage } from './components/dashboard/RecommendationsPage';
import { ReportsPage } from './components/dashboard/ReportsPage';
import { SettingsPage } from './components/dashboard/SettingsPage';

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

export default function App() {
  // Top-level View State: 'landing' vs 'dashboard'
  const [appMode, setAppMode] = useState<'landing' | 'dashboard'>('landing');
  const [dashboardPage, setDashboardPage] = useState<DashboardPage>('overview');

  // Building State & Telemetry
  const [floorState, setFloorState] = useState<FloorState | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [energyHistory, setEnergyHistory] = useState<EnergyDataPoint[]>([]);
  const [occupancyHistory, setOccupancyHistory] = useState<OccupancyDataPoint[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<RoomId | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toISOString());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Video Upload & Results
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResult | null>(null);

  const { toasts, show: showToast } = useToasts();
  const wsCleanupRef = useRef<(() => void) | null>(null);

  // ---------------------------------------------------------------
  // Initial Data Ingestion
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
        setLoadError('Connecting in Standalone/Demo mode. Backend telemetry simulated.');
        console.warn('[eprodux] Load notice:', err);
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
  // Live WebSocket Push (Live Mode)
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
  // Recommendation Actions
  // ---------------------------------------------------------------
  const handleAccept = useCallback(
    async (id: string) => {
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'accepted' } : r)),
      );
      showToast('Recommendation accepted for review. No physical hardware was changed.', 'success');
      await acceptRecommendation(id);
    },
    [showToast],
  );

  const handleDismiss = useCallback(
    async (id: string) => {
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'dismissed' } : r)),
      );
      showToast('Recommendation dismissed from active audit.', 'info');
      await dismissRecommendation(id);
    },
    [showToast],
  );

  // ---------------------------------------------------------------
  // Video Analysis Completion Workflow
  // ---------------------------------------------------------------
  const handleAnalysisComplete = useCallback(
    (result: VideoAnalysisResult) => {
      setAnalysisResult(result);
      showToast(`Video analysis completed: ${result.fileName}`, 'success');

      // Reflect detected zone headcounts into floor state
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

      // Transition to Dashboard Video Analysis page
      setAppMode('dashboard');
      setDashboardPage('video');
    },
    [showToast],
  );

  // ---------------------------------------------------------------
  // Loading Shimmer Screen
  // ---------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="app-layout">
        <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <div className="brand-logo">EP</div>
            <div className="brand-name">Eprodux</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="loading-shimmer" style={{ height: 100 }} />
            ))}
          </div>
          <div className="loading-shimmer" style={{ height: 420, marginTop: 24 }} />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Render: 3D Landing Page vs Enterprise Dashboard
  // ---------------------------------------------------------------
  return (
    <>
      {loadError && (
        <div
          style={{
            padding: '8px 20px',
            background: 'var(--alert-warning-bg)',
            borderBottom: '1px solid rgba(245,158,11,0.3)',
            fontSize: '0.74rem',
            color: 'var(--alert-warning)',
            textAlign: 'center',
          }}
          role="alert"
        >
          ℹ️ {loadError}
        </div>
      )}

      {appMode === 'landing' ? (
        // ── 1. 3D LANDING PAGE ──
        <div className="app-layout">
          <LandingHeader
            floorState={floorState}
            onOpenUpload={() => setIsUploadModalOpen(true)}
            onLaunchDashboard={() => {
              setAppMode('dashboard');
              setDashboardPage('overview');
            }}
          />

          <main role="main">
            <LandingHero
              floorState={floorState}
              selectedRoomId={selectedRoomId}
              onRoomSelect={(id) => setSelectedRoomId((prev) => (prev === id ? null : id))}
              onOpenUpload={() => setIsUploadModalOpen(true)}
              onLaunchDashboard={() => {
                setAppMode('dashboard');
                setDashboardPage('overview');
              }}
            />

            <LandingFeatures />

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
              onExploreInsights={() => {
                setAppMode('dashboard');
                setDashboardPage('recommendations');
              }}
            />

            <LandingFinalCta
              onLaunchDashboard={() => {
                setAppMode('dashboard');
                setDashboardPage('overview');
              }}
              onOpenUpload={() => setIsUploadModalOpen(true)}
            />

            <LandingTransparency />

            <LandingFooter />
          </main>
        </div>
      ) : (
        // ── 2. ENTERPRISE SUSTAINABILITY DASHBOARD ──
        <DashboardLayout
          currentPage={dashboardPage}
          onPageChange={setDashboardPage}
          onBackToLanding={() => setAppMode('landing')}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          floorState={floorState}
          lastUpdate={lastUpdate}
        >
          {dashboardPage === 'overview' && (
            <OverviewPage
              floorState={floorState}
              alerts={alerts}
              recommendations={recommendations}
              energyHistory={energyHistory}
              occupancyHistory={occupancyHistory}
              selectedRoomId={selectedRoomId}
              onRoomSelect={setSelectedRoomId}
              onAcceptRec={handleAccept}
              onDismissRec={handleDismiss}
              onNavigateToTwin={() => setDashboardPage('twin')}
            />
          )}

          {dashboardPage === 'twin' && (
            <DigitalTwinPage
              floorState={floorState}
              alerts={alerts}
              recommendations={recommendations}
              selectedRoomId={selectedRoomId}
              onRoomSelect={setSelectedRoomId}
            />
          )}

          {dashboardPage === 'video' && (
            <VideoAnalysisPage
              latestResult={analysisResult}
              onAnalysisSuccess={handleAnalysisComplete}
              onInspectIn3D={(roomId) => {
                setSelectedRoomId(roomId);
                setDashboardPage('twin');
              }}
            />
          )}

          {dashboardPage === 'energy' && (
            <EnergyPage
              floorState={floorState}
            />
          )}

          {dashboardPage === 'recommendations' && (
            <RecommendationsPage
              recommendations={recommendations}
              onAccept={handleAccept}
              onDismiss={handleDismiss}
            />
          )}

          {dashboardPage === 'reports' && (
            <ReportsPage
              floorState={floorState}
              alerts={alerts}
              recommendations={recommendations}
            />
          )}

          {dashboardPage === 'settings' && (
            <SettingsPage floorState={floorState} />
          )}
        </DashboardLayout>
      )}

      {/* Video Upload Modal (Accessible from anywhere) */}
      <VideoUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onAnalysisComplete={handleAnalysisComplete}
      />

      {/* Analysis Results Inspector Modal */}
      <AnalysisResultsModal
        result={analysisResult}
        isOpen={isResultsModalOpen}
        onClose={() => setIsResultsModalOpen(false)}
        onInspectRoom={(roomId) => {
          setSelectedRoomId(roomId);
          setAppMode('dashboard');
          setDashboardPage('twin');
        }}
      />

      {/* Toast Notification Container */}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
