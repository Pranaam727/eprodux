# Eprodux – Digital Twin Energy Dashboard

**Hackathon project: DSU · Team Eprodux**

A real-time building-energy intelligence dashboard for one university floor (Floor 3), implementing the **Sense → See → Twin → Think → Act** pipeline.

---

## Quick Start

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Copy environment config (demo mode is on by default)
cp .env.example .env

# 3. Run dev server
npm run dev
```

Open <http://localhost:5173> in your browser.

> **Demo mode is the default.** No backend, no API key, and no internet connection is required to run the dashboard in demo mode.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_DEMO_MODE` | `true` | Set to `false` to connect to live backend services |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Twin/GenAI API base URL |
| `VITE_WS_URL` | `ws://localhost:8000/ws` | WebSocket URL for live push events |

---

## Run / Build Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start Vite dev server (hot reload) |
| `npm run build` | TypeScript check + production bundle |
| `npm run lint` | Oxlint static analysis |
| `npx tsc --noEmit` | TypeScript-only check |

---

## Features

### P0 – Core
- [x] Demo/mock mode (works offline, no backend)
- [x] Predictable, honest simulated data for all four rooms
- [x] API adapter layer (`src/services/api.ts`) — connects or falls back gracefully

### P1 – Dashboard & Floor Plan
- [x] KPI card strip (occupancy, energy, CO₂, alerts, potential savings)
- [x] Interactive 2D SVG floor plan with per-room status
- [x] Lighting state labeled as **manual input** throughout

### P2 – Details & Alerts
- [x] Room detail panel (click any room) with metric cards
- [x] Stale/offline warning — never coerces occupancy to 0
- [x] Alert panel sorted by severity
- [x] Recommendation panel with Accept / Dismiss (UI-only, no physical control)

### P3 – Simulator, Charts, Assistant
- [x] What-If simulator with sliders, deterministic math, assumption table
- [x] Recharts energy/occupancy history with simulated-data label
- [x] Chat assistant panel with demo fallback responses

### P4 – Integration & Polish
- [x] WebSocket adapter with safe exponential back-off reconnect
- [x] TypeScript interfaces for all shared data
- [x] Toast notifications for accept/dismiss
- [x] Pipeline status card (Sense → See → Twin → Think → Act)

---

## Application Structure

```
frontend/
  src/
    types/
      index.ts            # All TypeScript interfaces
    services/
      api.ts              # API + WebSocket service layer (all network access)
      mockData.ts         # Predictable demo data for all four rooms
    utils/
      simulator.ts        # What-If deterministic calculation engine
    components/
      AppHeader.tsx       # Header with branding, tabs, mode indicator
      KPICards.tsx        # Five floor-level KPI cards
      FloorPlan.tsx       # Interactive 2D SVG floor plan
      RoomDetailPanel.tsx # Selected room detail + alerts + recommendations
      AlertPanel.tsx      # Active alerts list
      RecommendationPanel.tsx  # GenAI recommendations with accept/dismiss
      WhatIfSimulator.tsx # Energy-saving policy simulator
      AnalyticsChart.tsx  # Recharts energy/occupancy history
      ChatAssistant.tsx   # Sustainability assistant panel
    App.tsx               # Root component, state, data loading
    main.tsx              # React entry point
    index.css             # Complete CSS design system
  index.html
  .env.example
  package.json
```

---

## Room IDs

These IDs are used consistently across the frontend and must be reused by all team members:

| ID | Display Name |
|---|---|
| `seminar_hall` | Seminar Hall |
| `classroom` | Classroom |
| `lab` | Laboratory |
| `office` | Office |

---

## API Contracts (Awaiting Backend)

### GET `/api/state` → `FloorState`
```typescript
interface FloorState {
  buildingName: string;
  floorName: string;
  rooms: Record<RoomId, RoomState>;
  totalOccupancy: number | null;
  totalEnergyKwh: number | null;
  avgCo2Ppm: number | null;
  lastUpdated: string | null; // ISO-8601
  connectionState: 'connected' | 'stale' | 'offline' | 'unknown';
  mode: 'demo' | 'live';
}
```

### WebSocket `ws://…/ws` → `Partial<FloorState>` push

### GET `/api/recommendations` → `Recommendation[]`
```typescript
interface Recommendation {
  id: string;
  issue: string;
  roomId: RoomId | 'floor';
  roomName: string;
  evidence: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  estimatedEnergySavedKwh: number;
  estimatedCostSavedInr: number;
  estimatedCo2SavedKg: number;
  guideline?: string;
  status: 'pending' | 'accepted' | 'dismissed';
  isDemo: boolean;
}
```

### POST `/api/recommendations/{id}/accept` — no body required
### POST `/api/recommendations/{id}/dismiss` — no body required

### POST `/api/chat`
```json
// Request
{ "message": "string" }
// Response
{ "response": "string" }
```

### CV → Twin Event Shape (agreed contract)
```json
{
  "zone_id": "seminar_hall",
  "timestamp": "ISO-8601",
  "occupancy": 12,
  "light_state": "ON",
  "confidence": 0.94
}
```
> ⚠️ `light_state` is **manually supplied**, not detected by CV. The UI labels it as "manual input" everywhere.

---

## Demo Mode Behavior

- All room data is seeded with predictable values
- Vacancy-with-lights-on scenario: **Seminar Hall** (0 occupants, light ON)
- Camera offline scenario: **Office** (occupancy shown as UNKNOWN, never 0)
- All values labeled "SIMULATED DATA" or "Demo"
- Recommendations, alerts, and chat responses are pre-written and data-grounded
- No API key, internet connection, or backend required

---

## Data Honesty Commitments

| Data type | How it's labeled |
|---|---|
| Camera occupancy | "CV estimated" |
| Lighting state | "manual input" |
| Meter/CO₂/temp | "simulated" |
| Recommendation savings | "modeled projection" |
| Simulator outputs | "illustrative estimates" |
| Demo chat responses | "⚗️ Demo Mode – not real GenAI analysis" |

Missing occupancy (camera offline) is **always shown as UNKNOWN** — never coerced to zero.

---

## What-If Simulator Assumptions

| Assumption | Default value | Source |
|---|---|---|
| Lighting power per room | 1000 W | Demonstration assumption |
| Electricity tariff | ₹8/kWh | Demonstration assumption |
| CO₂ emission factor | 0.82 kg/kWh | India grid avg, CEA 2023 |

Formula: `dailyEnergy = rooms × hours × powerW / 1000`

---

## Validation Commands Run & Results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Exit 0, no errors |
| `npm run build` | ✅ Exit 0 — 601 modules, built in 5.44s |
| `npm run lint` | ✅ Exit 0 — 0 errors, 3 advisory warnings (false-positive React Compiler purity warnings on `new Date()` inside event handlers, not render functions) |

---

## Remaining Integration Tasks

### Member 2 – Backend / Twin service
- Implement `GET /api/state` returning `FloorState` schema above
- Implement `WebSocket /ws` pushing `Partial<FloorState>` updates
- Implement `GET /api/alerts` returning `Alert[]`
- Set `CORS` headers to allow `http://localhost:5173`
- Confirm or adjust room IDs (`seminar_hall`, `classroom`, `lab`, `office`)

### Member 3 – CV service
- Confirm the event shape: `{ zone_id, timestamp, occupancy, light_state, confidence }`
- Note: `light_state` in the event is **manually supplied** (not detected by CV)
- Push events to the Twin service; the frontend will receive them via WebSocket
- If source health is reported, add a `connectionState` field or use timestamp staleness

### Member 4 (this repo) – GenAI / recommendations
- Implement `GET /api/recommendations` returning the `Recommendation[]` schema
- Implement `POST /api/chat` → `{ response: string }` for the assistant panel
- Implement `POST /api/recommendations/{id}/accept|dismiss`
- The existing mock recommendations in `src/services/mockData.ts` show the expected data shape

### Frontend — post-integration
- Set `VITE_DEMO_MODE=false` in `.env`
- Test WebSocket reconnection behavior under real network conditions
- Add code-splitting to reduce the 632 kB JS bundle (currently informational, not a build error)

---

## Known Limitations

- The JS bundle is ~633 kB (includes React 19 + Recharts). Consider lazy-loading the Chart and Simulator tabs for production.
- WebSocket reconnect uses in-memory state; page refresh resets the connection counter.
- The chat assistant returns deterministic demo responses in demo mode — real GenAI requires connecting `/api/chat`.
- No authentication or multi-user state.

---

## Git Branch

`feature/frontend-dashboard` — do not merge to `main` without team review.