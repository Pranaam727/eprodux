// ============================================================
// Eprodux – API / WebSocket Service Layer
// All network access is isolated here.
// UI components import from this file only – never fetch directly.
// ============================================================

import type {
  FloorState,
  Alert,
  Recommendation,
  EnergyDataPoint,
  OccupancyDataPoint,
  ChatMessage,
} from '../types';
import {
  MOCK_FLOOR_STATE,
  MOCK_ALERTS,
  MOCK_RECOMMENDATIONS,
  MOCK_ENERGY_HISTORY,
  MOCK_OCCUPANCY_HISTORY,
  DEMO_CHAT_RESPONSES,
} from './mockData';

// ---------------------------------------------------------------
// Configuration – driven by environment variables
// ---------------------------------------------------------------
const IS_DEMO = import.meta.env.VITE_DEMO_MODE !== 'false';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000/ws';

/** How many seconds without a push before a room is considered stale */
const STALE_THRESHOLD_SECONDS = 120;

// ---------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------
function isStale(isoTimestamp: string | null): boolean {
  if (!isoTimestamp) return true;
  const ageMs = Date.now() - new Date(isoTimestamp).getTime();
  return ageMs > STALE_THRESHOLD_SECONDS * 1000;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${path}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------
// Floor state
// ---------------------------------------------------------------
export async function fetchFloorState(): Promise<FloorState> {
  if (IS_DEMO) return MOCK_FLOOR_STATE;

  try {
    const raw = await apiFetch<FloorState>('/api/state');
    // Validate and annotate staleness
    for (const roomId in raw.rooms) {
      const room = raw.rooms[roomId as keyof typeof raw.rooms];
      if (isStale(room.lastUpdated)) {
        room.connectionState = 'stale';
        // CRITICAL: do NOT coerce null occupancy to 0
      }
    }
    return raw;
  } catch {
    console.warn('[eprodux] /api/state unavailable – falling back to mock data');
    return { ...MOCK_FLOOR_STATE, mode: 'demo' };
  }
}

// ---------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------
export async function fetchAlerts(): Promise<Alert[]> {
  if (IS_DEMO) return MOCK_ALERTS;
  try {
    return await apiFetch<Alert[]>('/api/alerts');
  } catch {
    console.warn('[eprodux] /api/alerts unavailable – falling back to mock data');
    return MOCK_ALERTS;
  }
}

// ---------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------
export async function fetchRecommendations(): Promise<Recommendation[]> {
  if (IS_DEMO) return MOCK_RECOMMENDATIONS;
  try {
    return await apiFetch<Recommendation[]>('/api/recommendations');
  } catch {
    console.warn('[eprodux] /api/recommendations unavailable – falling back to mock data');
    return MOCK_RECOMMENDATIONS;
  }
}

// ---------------------------------------------------------------
// Accept / Dismiss recommendation – UI-only in demo mode
// ---------------------------------------------------------------
export async function acceptRecommendation(id: string): Promise<void> {
  if (IS_DEMO) return; // handled locally in state
  try {
    await fetch(`${API_BASE_URL}/api/recommendations/${id}/accept`, { method: 'POST' });
  } catch {
    console.warn('[eprodux] accept recommendation failed – applied locally only');
  }
}

export async function dismissRecommendation(id: string): Promise<void> {
  if (IS_DEMO) return;
  try {
    await fetch(`${API_BASE_URL}/api/recommendations/${id}/dismiss`, { method: 'POST' });
  } catch {
    console.warn('[eprodux] dismiss recommendation failed – applied locally only');
  }
}

// ---------------------------------------------------------------
// Energy & occupancy history
// ---------------------------------------------------------------
export async function fetchEnergyHistory(): Promise<EnergyDataPoint[]> {
  if (IS_DEMO) return MOCK_ENERGY_HISTORY;
  try {
    return await apiFetch<EnergyDataPoint[]>('/api/summary?period=day');
  } catch {
    console.warn('[eprodux] energy history unavailable – using simulated data');
    return MOCK_ENERGY_HISTORY;
  }
}

export async function fetchOccupancyHistory(): Promise<OccupancyDataPoint[]> {
  if (IS_DEMO) return MOCK_OCCUPANCY_HISTORY;
  try {
    return await apiFetch<OccupancyDataPoint[]>('/api/occupancy-history?period=day');
  } catch {
    console.warn('[eprodux] occupancy history unavailable – using simulated data');
    return MOCK_OCCUPANCY_HISTORY;
  }
}

// ---------------------------------------------------------------
// Chat / sustainability assistant
// ---------------------------------------------------------------
export async function sendChatMessage(
  userMessage: string,
  _history: ChatMessage[],
): Promise<string> {
  if (IS_DEMO) return getDemoChatResponse(userMessage);

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { response: string };
    return data.response;
  } catch {
    console.warn('[eprodux] chat endpoint unavailable – returning demo response');
    return getDemoChatResponse(userMessage);
  }
}

function getDemoChatResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('wast') || lower.includes('most energy')) {
    return DEMO_CHAT_RESPONSES.wasting;
  }
  if (lower.includes('seminar') || lower.includes('flagged') || lower.includes('alert')) {
    return DEMO_CHAT_RESPONSES.seminar;
  }
  if (lower.includes('lighting') || lower.includes('light') || lower.includes('what if')) {
    return DEMO_CHAT_RESPONSES.lighting;
  }
  return DEMO_CHAT_RESPONSES.default;
}

// ---------------------------------------------------------------
// WebSocket – live push from Twin service
// ---------------------------------------------------------------
export type WSMessageHandler = (update: Partial<FloorState>) => void;
export type WSStatusHandler = (status: 'connected' | 'disconnected' | 'error') => void;

let wsInstance: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY_MS = 30_000;

export function connectWebSocket(
  onMessage: WSMessageHandler,
  onStatus: WSStatusHandler,
): () => void {
  if (IS_DEMO) return () => {}; // no-op in demo mode

  function connect() {
    // Prevent duplicate connections
    if (wsInstance && wsInstance.readyState === WebSocket.OPEN) return;

    wsInstance = new WebSocket(WS_URL);

    wsInstance.onopen = () => {
      reconnectAttempts = 0;
      onStatus('connected');
    };

    wsInstance.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string) as Partial<FloorState>;
        onMessage(data);
      } catch {
        console.warn('[eprodux] Received invalid WS message, ignoring');
      }
    };

    wsInstance.onerror = () => {
      onStatus('error');
    };

    wsInstance.onclose = () => {
      onStatus('disconnected');
      wsInstance = null;

      // Exponential back-off reconnect – capped at 30 s
      const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY_MS);
      reconnectAttempts++;
      reconnectTimer = setTimeout(connect, delay);
    };
  }

  connect();

  // Return cleanup function
  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (wsInstance) {
      wsInstance.onclose = null; // prevent reconnect on intentional close
      wsInstance.close();
      wsInstance = null;
    }
  };
}

export { IS_DEMO };
