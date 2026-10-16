// ============================================================
// Eprodux – Mock Data
// All values are SIMULATED / DEMO DATA – clearly labeled.
// These are used when the backend services are not available.
// ============================================================

import type {
  RoomState,
  FloorState,
  Alert,
  Recommendation,
  EnergyDataPoint,
  OccupancyDataPoint,
  RoomId,
} from '../types';

// ---------------------------------------------------------------
// Room metadata
// ---------------------------------------------------------------
export const ROOM_METADATA: Record<RoomId, { name: string; area: number }> = {
  seminar_hall: { name: 'Seminar Hall', area: 120 },
  classroom: { name: 'Classroom', area: 60 },
  lab: { name: 'Laboratory', area: 80 },
  office: { name: 'Office', area: 40 },
};

// ---------------------------------------------------------------
// Mock room states (seeded, predictable)
// ---------------------------------------------------------------
export const MOCK_ROOMS: Record<RoomId, RoomState> = {
  seminar_hall: {
    id: 'seminar_hall',
    name: 'Seminar Hall',
    occupancy: 0,
    lightState: 'ON',        // lights are ON but room is VACANT → alert
    energyKwh: 3.6,
    co2Ppm: 412,
    temperatureC: 24.1,
    confidence: 0.91,
    lastUpdated: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    connectionState: 'connected',
    dataSource: 'simulated',
  },
  classroom: {
    id: 'classroom',
    name: 'Classroom',
    occupancy: 28,
    lightState: 'ON',
    energyKwh: 2.1,
    co2Ppm: 680,
    temperatureC: 26.3,
    confidence: 0.87,
    lastUpdated: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    connectionState: 'connected',
    dataSource: 'simulated',
  },
  lab: {
    id: 'lab',
    name: 'Laboratory',
    occupancy: 7,
    lightState: 'ON',
    energyKwh: 4.8,
    co2Ppm: 520,
    temperatureC: 22.5,
    confidence: 0.78,
    lastUpdated: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    connectionState: 'connected',
    dataSource: 'simulated',
  },
  office: {
    id: 'office',
    name: 'Office',
    occupancy: null,          // camera OFFLINE – must show UNKNOWN, not 0
    lightState: 'UNKNOWN',
    energyKwh: 1.2,
    co2Ppm: null,
    temperatureC: null,
    confidence: null,
    lastUpdated: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    connectionState: 'offline',
    dataSource: 'unknown',
  },
};

// ---------------------------------------------------------------
// Floor-level aggregated state
// ---------------------------------------------------------------
export const MOCK_FLOOR_STATE: FloorState = {
  buildingName: 'DSU Main Building',
  floorName: 'Floor 3',
  rooms: MOCK_ROOMS,
  totalOccupancy: 35,   // office excluded (unknown)
  totalEnergyKwh: 11.7,
  avgCo2Ppm: 537,
  lastUpdated: new Date().toISOString(),
  connectionState: 'connected',
  mode: 'demo',
};

// ---------------------------------------------------------------
// Mock alerts
// ---------------------------------------------------------------
export const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert-001',
    severity: 'critical',
    roomId: 'seminar_hall',
    roomName: 'Seminar Hall',
    title: 'Lights ON in Vacant Room',
    description:
      'CV estimates occupancy = 0 but lighting state is manually reported as ON. ' +
      'This is a likely energy waste scenario.',
    timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    status: 'active',
    isDemoScenario: true,
  },
  {
    id: 'alert-002',
    severity: 'warning',
    roomId: 'lab',
    roomName: 'Laboratory',
    title: 'Above-Average Energy Consumption',
    description:
      'Laboratory energy consumption (4.8 kWh, simulated) is above the typical baseline ' +
      'of ≈2.5 kWh for this time period.',
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    status: 'active',
    isDemoScenario: true,
  },
  {
    id: 'alert-003',
    severity: 'critical',
    roomId: 'office',
    roomName: 'Office',
    title: 'Camera Offline',
    description:
      'No data received from the Office camera for >15 minutes. ' +
      'Occupancy is UNKNOWN – not assumed empty.',
    timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    status: 'active',
    isDemoScenario: false,
  },
  {
    id: 'alert-004',
    severity: 'info',
    roomId: 'classroom',
    roomName: 'Classroom',
    title: 'High CO₂ Level',
    description:
      'CO₂ reading (680 ppm, simulated) is elevated. Consider increasing ventilation.',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    status: 'active',
    isDemoScenario: true,
  },
];

// ---------------------------------------------------------------
// Mock recommendations
// ---------------------------------------------------------------
export const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'rec-001',
    issue: 'Vacant room with lights ON',
    roomId: 'seminar_hall',
    roomName: 'Seminar Hall',
    evidence:
      'CV reports 0 occupants (confidence 0.91, simulated). ' +
      'Lighting state manually reported as ON.',
    action: 'Turn off lights in Seminar Hall to eliminate unnecessary energy draw.',
    priority: 'high',
    estimatedEnergySavedKwh: 1.5,
    estimatedCostSavedInr: 12.0,
    estimatedCo2SavedKg: 1.23,
    guideline: 'ECBC 2023 §4.3 – Occupancy-based lighting controls',
    status: 'pending',
    isDemo: true,
  },
  {
    id: 'rec-002',
    issue: 'Lab energy consumption above baseline',
    roomId: 'lab',
    roomName: 'Laboratory',
    evidence:
      'Current estimated consumption is 4.8 kWh (simulated), ~90 % above 2.5 kWh baseline.',
    action:
      'Audit lab equipment left on standby. ' +
      'Implement equipment power-down schedule during low-occupancy periods.',
    priority: 'medium',
    estimatedEnergySavedKwh: 1.2,
    estimatedCostSavedInr: 9.6,
    estimatedCo2SavedKg: 0.98,
    guideline: 'BEE Star Rating – Laboratory Equipment Schedule',
    status: 'pending',
    isDemo: true,
  },
  {
    id: 'rec-003',
    issue: 'Elevated CO₂ in occupied classroom',
    roomId: 'classroom',
    roomName: 'Classroom',
    evidence:
      'CO₂ at 680 ppm (simulated) with 28 occupants. ' +
      'ASHRAE 62.1 recommends <700 ppm above outdoor baseline.',
    action:
      'Increase HVAC fresh-air intake to reduce CO₂ concentration ' +
      'and improve occupant comfort.',
    priority: 'medium',
    estimatedEnergySavedKwh: 0.0,
    estimatedCostSavedInr: 0.0,
    estimatedCo2SavedKg: 0.0,
    guideline: 'ASHRAE 62.1 – Ventilation for Acceptable Indoor Air Quality',
    status: 'pending',
    isDemo: true,
  },
  {
    id: 'rec-004',
    issue: 'Office camera offline – no energy data',
    roomId: 'office',
    roomName: 'Office',
    evidence: 'Camera has been offline for >15 minutes. Occupancy and lighting state are unknown.',
    action:
      'Restore camera connectivity. Until then, manually verify office occupancy and lighting.',
    priority: 'low',
    estimatedEnergySavedKwh: 0.0,
    estimatedCostSavedInr: 0.0,
    estimatedCo2SavedKg: 0.0,
    status: 'pending',
    isDemo: false,
  },
];

// ---------------------------------------------------------------
// Energy history – last 8 hours, 1-hour buckets (simulated)
// ---------------------------------------------------------------
function hoursAgo(h: number): string {
  const d = new Date(Date.now() - h * 60 * 60 * 1000);
  return `${d.getHours().toString().padStart(2, '0')}:00`;
}

export const MOCK_ENERGY_HISTORY: EnergyDataPoint[] = (() => {
  const rooms: RoomId[] = ['seminar_hall', 'classroom', 'lab', 'office'];
  const baseValues: Record<RoomId, number> = {
    seminar_hall: 2.0,
    classroom: 1.8,
    lab: 3.5,
    office: 1.0,
  };
  const points: EnergyDataPoint[] = [];
  for (let h = 7; h >= 0; h--) {
    for (const roomId of rooms) {
      const jitter = (Math.sin(h * 2.3 + roomId.length) * 0.4);
      points.push({
        timestamp: hoursAgo(h),
        roomId,
        energyKwh: Math.max(0, +(baseValues[roomId] + jitter).toFixed(2)),
        isSimulated: true,
      });
    }
  }
  return points;
})();

// ---------------------------------------------------------------
// Occupancy history – last 8 hours (simulated)
// ---------------------------------------------------------------
export const MOCK_OCCUPANCY_HISTORY: OccupancyDataPoint[] = (() => {
  const rooms: RoomId[] = ['seminar_hall', 'classroom', 'lab', 'office'];
  const baseValues: Record<RoomId, number> = {
    seminar_hall: 10,
    classroom: 22,
    lab: 8,
    office: 4,
  };
  const points: OccupancyDataPoint[] = [];
  for (let h = 7; h >= 0; h--) {
    for (const roomId of rooms) {
      const jitter = Math.round(Math.sin(h * 1.7 + roomId.length * 0.5) * 5);
      points.push({
        timestamp: hoursAgo(h),
        roomId,
        count: Math.max(0, baseValues[roomId] + jitter),
        isSimulated: true,
      });
    }
  }
  return points;
})();

// ---------------------------------------------------------------
// Demo chat responses (deterministic, data-grounded)
// ---------------------------------------------------------------
export const DEMO_CHAT_RESPONSES: Record<string, string> = {
  default:
    '⚠️ Demo Mode – responses are based on mock data, not real GenAI analysis.\n\n' +
    'The GenAI assistant endpoint (/api/chat) is not yet connected. ' +
    'Please integrate the backend chat service to enable live responses.',

  wasting:
    '⚠️ Demo Mode\n\n' +
    'Based on simulated data, the **Seminar Hall** is the highest-priority concern: ' +
    '0 occupants detected (CV confidence 0.91) but lighting is manually reported as ON, ' +
    'wasting an estimated 1.5 kWh. The **Laboratory** is second, at 4.8 kWh versus ' +
    'a 2.5 kWh baseline.',

  seminar:
    '⚠️ Demo Mode\n\n' +
    'The Seminar Hall is flagged because CV estimates 0 occupancy ' +
    '(confidence 0.91, simulated) while the lighting state is manually reported as ON. ' +
    'This vacancy-with-lights-on scenario is the highest-priority alert.',

  lighting:
    '⚠️ Demo Mode\n\n' +
    'Using the What-If Simulator with default assumptions (1 room, 2 avoidable hours/day, ' +
    '1000 W, ₹8/kWh, 0.82 kg CO₂/kWh, 5 days/week, 48 weeks/year): ' +
    'you would save ≈ 2 kWh/day, ₹16/day, 1.64 kg CO₂/day, ' +
    'and ≈ 480 kWh / ₹3,840 / 394 kg CO₂ per year.',
};
