// ============================================================
// Eprodux – Shared TypeScript types
// All data shapes used across the dashboard are defined here.
// ============================================================

/** Stable room identifiers agreed across CV, Twin, and GenAI services */
export type RoomId = 'seminar_hall' | 'classroom' | 'lab' | 'office';

/** Source classification – used to label data origin honestly */
export type DataSource = 'measured' | 'simulated' | 'estimated' | 'manual' | 'unknown';

/** Lighting state – manually supplied, NOT from CV */
export type LightState = 'ON' | 'OFF' | 'UNKNOWN';

/** Alert severity levels */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/** Recommendation priority */
export type Priority = 'high' | 'medium' | 'low';

/** Connection / data-freshness state */
export type ConnectionState = 'connected' | 'stale' | 'offline' | 'unknown';

// ---------------------------------------------------------------
// CV → Twin event shape (agreed contract)
// light_state is present in the event but comes from manual input,
// NOT from computer vision. UI must label it accordingly.
// ---------------------------------------------------------------
export interface CVEvent {
  zone_id: RoomId;
  timestamp: string; // ISO-8601
  occupancy: number;
  light_state: LightState;
  confidence: number; // 0–1
}

// ---------------------------------------------------------------
// Room state (Twin representation)
// ---------------------------------------------------------------
export interface RoomState {
  id: RoomId;
  name: string;
  occupancy: number | null;         // null = UNKNOWN, never coerce to 0
  lightState: LightState;
  energyKwh: number | null;         // null = unavailable
  co2Ppm: number | null;            // null = unavailable
  temperatureC: number | null;      // null = unavailable
  confidence: number | null;        // CV confidence 0–1
  lastUpdated: string | null;       // ISO-8601 timestamp from CV
  connectionState: ConnectionState;
  dataSource: DataSource;
}

// ---------------------------------------------------------------
// Floor-level state (Twin → Dashboard)
// ---------------------------------------------------------------
export interface FloorState {
  buildingName: string;
  floorName: string;
  rooms: Record<RoomId, RoomState>;
  totalOccupancy: number | null;
  totalEnergyKwh: number | null;
  avgCo2Ppm: number | null;
  lastUpdated: string | null;
  connectionState: ConnectionState;
  mode: 'demo' | 'live';
}

// ---------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------
export interface Alert {
  id: string;
  severity: AlertSeverity;
  roomId: RoomId | 'floor';
  roomName: string;
  title: string;
  description: string;
  timestamp: string;   // ISO-8601
  status: 'active' | 'acknowledged' | 'resolved';
  isDemoScenario: boolean; // must be true when based on mock data
}

// ---------------------------------------------------------------
// Recommendations (GenAI → Dashboard)
// ---------------------------------------------------------------
export interface Recommendation {
  id: string;
  issue: string;
  roomId: RoomId | 'floor';
  roomName: string;
  evidence: string;
  action: string;
  priority: Priority;
  estimatedEnergySavedKwh: number;  // modeled projection
  estimatedCostSavedInr: number;    // modeled projection
  estimatedCo2SavedKg: number;      // modeled projection
  guideline?: string;
  status: 'pending' | 'accepted' | 'dismissed';
  isDemo: boolean;
}

// ---------------------------------------------------------------
// What-If Simulator inputs / outputs
// ---------------------------------------------------------------
export interface SimulatorInputs {
  /** Rooms included in the scenario */
  selectedRooms: RoomId[];
  /** Avoidable lighting hours per day (0–24) */
  avoidableLightingHours: number;
  /** Lighting power per room in watts (assumption – labeled) */
  lightingPowerWattsPerRoom: number;
  /** Electricity tariff in ₹/kWh (assumption – labeled) */
  tariffInrPerKwh: number;
  /** CO₂ emission factor in kg/kWh (assumption – labeled) */
  co2KgPerKwh: number;
  /** Days per week the policy applies */
  daysPerWeek: number;
  /** Weeks per year the policy applies */
  weeksPerYear: number;
}

export interface SimulatorOutputs {
  dailyEnergySavedKwh: number;
  weeklyEnergySavedKwh: number;
  annualEnergySavedKwh: number;
  dailyCostSavedInr: number;
  weeklyCostSavedInr: number;
  annualCostSavedInr: number;
  dailyCo2SavedKg: number;
  weeklyCo2SavedKg: number;
  annualCo2SavedKg: number;
  /** Snapshot of the assumptions used – displayed to user */
  assumptions: Record<string, string>;
}

// ---------------------------------------------------------------
// Chat / assistant
// ---------------------------------------------------------------
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isDemo: boolean;
}

// ---------------------------------------------------------------
// Energy history data point
// ---------------------------------------------------------------
export interface EnergyDataPoint {
  timestamp: string; // ISO-8601 or 'HH:mm' label
  roomId: RoomId;
  energyKwh: number;
  isSimulated: boolean;
}

// ---------------------------------------------------------------
// Occupancy history data point
// ---------------------------------------------------------------
export interface OccupancyDataPoint {
  timestamp: string;
  roomId: RoomId;
  count: number;
  isSimulated: boolean;
}

// ---------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

// ---------------------------------------------------------------
// Video Upload & CV Analysis Pipeline Contracts
// ---------------------------------------------------------------
export type VideoAnalysisStatus =
  | 'idle'
  | 'selected'
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface VideoAnalysisEvent {
  timestampSeconds: number;
  timecode: string;
  roomId: RoomId;
  occupancy: number; // Retained for backwards compatibility (current active tracks)
  currentOccupancy?: number; // Active tracks currently present in zone
  detectionCount?: number; // Raw bounding box detections in this frame
  uniqueTrackedPeople?: number; // Cumulative unique tracking IDs observed in interval
  confidence: number; // Sliding window temporal count-stability score
  delta?: number;
  activity?: string;
  frameNumber?: number;
}

export interface VideoRoomObservation {
  roomId: RoomId;
  roomName: string;
  peakOccupancy: number;
  averageOccupancy: number;
  currentOccupancy: number | null;
  detectionCount?: number | null;
  uniqueTrackedPeople?: number;
  lightingState: LightState;
  lightingProvenance: 'manual' | 'simulated' | 'unknown';
  anomalies: string[];
  confidence: number;
  freshnessIso: string;
}

export interface VideoAnalysisResult {
  jobId: string;
  fileName: string;
  fileSizeBytes: number;
  durationSeconds: number;
  fps: number;
  totalFrames: number;
  status: 'completed' | 'failed';
  isDemo: boolean;
  processedAt: string;
  observations: Record<RoomId, VideoRoomObservation>;
  timeline: VideoAnalysisEvent[];
  summary: string;
  warnings: string[];
  limitations?: string[];
}

