// ============================================================
// OverviewPage.tsx — Eprodux Central Operations Dashboard
// KPIs, Trends, Occupancy vs Energy, Anomalies & Latest Recommendations
// ============================================================

import { useState } from 'react';
import type {
  FloorState,
  Alert,
  Recommendation,
  EnergyDataPoint,
  OccupancyDataPoint,
  RoomId,
} from '../../types';
import { KPICards } from '../KPICards';
import { FloorPlan } from '../FloorPlan';
import { RoomDetailPanel } from '../RoomDetailPanel';
import { AlertPanel } from '../AlertPanel';
import { RecommendationPanel } from '../RecommendationPanel';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Props {
  floorState: FloorState | null;
  alerts: Alert[];
  recommendations: Recommendation[];
  energyHistory: EnergyDataPoint[];
  occupancyHistory: OccupancyDataPoint[];
  selectedRoomId: RoomId | null;
  onRoomSelect: (roomId: RoomId | null) => void;
  onAcceptRec: (id: string) => void;
  onDismissRec: (id: string) => void;
  onNavigateToTwin: () => void;
}

export function OverviewPage({
  floorState,
  alerts,
  recommendations,
  energyHistory,
  occupancyHistory,
  selectedRoomId,
  onRoomSelect,
  onAcceptRec,
  onDismissRec,
  onNavigateToTwin,
}: Props) {
  const [chartMode, setChartMode] = useState<'occupancy' | 'energy'>('occupancy');

  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const potentialSavingsKwh = recommendations
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + r.estimatedEnergySavedKwh, 0);

  const selectedRoom = selectedRoomId && floorState ? floorState.rooms[selectedRoomId] : null;

  // Process data for charts
  const timeLabels = Array.from(new Set(occupancyHistory.map((d) => d.timestamp)));
  const occupancyChartData = timeLabels.map((time) => {
    const point: any = { time };
    occupancyHistory
      .filter((d) => d.timestamp === time)
      .forEach((d) => {
        point[d.roomId] = d.count;
      });
    return point;
  });

  const energyChartData = timeLabels.map((time) => {
    const point: any = { time };
    energyHistory
      .filter((d) => d.timestamp === time)
      .forEach((d) => {
        point[d.roomId] = d.energyKwh;
      });
    return point;
  });

  // Room Utilization Data
  const utilizationData = [
    { room: 'Seminar Hall', occupancy: 0, capacity: 120, utilization: 0 },
    { room: 'Classroom', occupancy: 28, capacity: 40, utilization: 70 },
    { room: 'Laboratory', occupancy: 7, capacity: 25, utilization: 28 },
    { room: 'Office', occupancy: 2, capacity: 15, utilization: 13 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── TOP KPI ROW ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="section-title">SUSTAINABILITY KEY PERFORMANCE INDICATORS</div>
          <div style={{ display: 'flex', gap: 8, fontSize: '0.70rem', color: 'var(--text-muted)' }}>
            <span>⚡ Simulated Meters</span>
            <span>•</span>
            <span>👁️ CV Occupancy</span>
            <span>•</span>
            <span>🌿 Calculated CO₂</span>
          </div>
        </div>

        <KPICards
          floorState={floorState}
          activeAlerts={activeAlerts}
          potentialSavingsKwh={potentialSavingsKwh}
        />
      </div>

      {/* ── INTERACTIVE FLOOR VIEW & TRENDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
        {/* Floor Map with 3D link */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <FloorPlan
              floorState={floorState}
              selectedRoomId={selectedRoomId}
              onRoomSelect={(id) => onRoomSelect(selectedRoomId === id ? null : id)}
            />
            <div style={{ position: 'absolute', top: 16, right: 16 }}>
              <button
                type="button"
                onClick={onNavigateToTwin}
                className="btn btn--primary btn--sm"
                style={{ backdropFilter: 'blur(8px)' }}
              >
                Switch to 3D View ↗
              </button>
            </div>
          </div>

          {selectedRoom && (
            <RoomDetailPanel
              room={selectedRoom}
              alerts={alerts}
              recommendations={recommendations}
              onClose={() => onRoomSelect(null)}
            />
          )}
        </div>

        {/* Temporal Trends Chart */}
        <div className="chart-container" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div className="section-title" style={{ marginBottom: 4 }}>
                {chartMode === 'occupancy' ? 'Zone Headcounts Over Time' : 'Energy Consumption (kWh)'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {chartMode === 'occupancy'
                  ? 'Source: CV YOLO inference (headcounts)'
                  : 'Source: Simulated campus sub-meters'}
              </div>
            </div>

            <div className="chart-tabs">
              <button
                type="button"
                className={`chart-tab ${chartMode === 'occupancy' ? 'chart-tab--active' : ''}`}
                onClick={() => setChartMode('occupancy')}
              >
                Occupancy
              </button>
              <button
                type="button"
                className={`chart-tab ${chartMode === 'energy' ? 'chart-tab--active' : ''}`}
                onClick={() => setChartMode('energy')}
              >
                Energy
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 280, width: '100%' }}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartMode === 'occupancy' ? occupancyChartData : energyChartData}>
                <defs>
                  <linearGradient id="colorSem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F5B82E" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F5B82E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorClass" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A3D900" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#A3D900" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLab" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00B8D9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00B8D9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" stroke="#A8B4CC" tick={{ fontSize: 11 }} />
                <YAxis stroke="#A8B4CC" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: '#07132D',
                    border: '1px solid #1A2945',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#F7FAFF',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#A8B4CC' }} />
                <Area type="monotone" dataKey="classroom" stroke="#A3D900" fillOpacity={1} fill="url(#colorClass)" name="Classroom" />
                <Area type="monotone" dataKey="lab" stroke="#00B8D9" fillOpacity={1} fill="url(#colorLab)" name="Laboratory" />
                <Area type="monotone" dataKey="seminar_hall" stroke="#F5B82E" fillOpacity={1} fill="url(#colorSem)" name="Seminar Hall" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Utilization Bar Chart */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>
              ROOM UTILIZATION (%)
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={utilizationData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} stroke="#A8B4CC" tick={{ fontSize: 10 }} unit="%" />
                <YAxis dataKey="room" type="category" stroke="#A8B4CC" tick={{ fontSize: 10 }} width={80} />
                <Tooltip
                  contentStyle={{ background: '#07132D', border: '1px solid #1A2945', borderRadius: 8, fontSize: 11, color: '#F7FAFF' }}
                />
                <Bar dataKey="utilization" fill="#A3D900" radius={[0, 4, 4, 0]} name="Capacity Utilized %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── ANOMALIES & RECOMMENDATIONS GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Active Anomalies & Events */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>
            ANOMALIES & AUDIT EVENTS ({activeAlerts.length})
          </div>
          <AlertPanel alerts={alerts} />
        </div>

        {/* Latest GenAI Recommendations */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>
            GENAI EFFICIENCY RECOMMENDATIONS ({recommendations.length})
          </div>
          <RecommendationPanel
            recommendations={recommendations}
            onAccept={onAcceptRec}
            onDismiss={onDismissRec}
          />
        </div>
      </div>
    </div>
  );
}
