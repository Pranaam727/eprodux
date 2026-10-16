// ============================================================
// AnalyticsChart – energy and occupancy history charts
// Uses recharts for compact, labeled visualizations.
// ============================================================

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

import type { EnergyDataPoint, OccupancyDataPoint, RoomId } from '../types';
import { ROOM_METADATA } from '../services/mockData';

interface Props {
  energyHistory: EnergyDataPoint[];
  occupancyHistory: OccupancyDataPoint[];
}

const ROOM_COLORS: Record<RoomId, string> = {
  seminar_hall: '#22c55e',
  classroom:    '#38bdf8',
  lab:          '#f59e0b',
  office:       '#a78bfa',
};

type ChartMode = 'energy' | 'occupancy';

function pivotData<T extends { timestamp: string; roomId: RoomId }>(
  points: T[],
  valueKey: keyof T,
): Record<string, string | number>[] {
  const byTimestamp: Record<string, Record<string, string | number>> = {};
  for (const pt of points) {
    if (!byTimestamp[pt.timestamp]) byTimestamp[pt.timestamp] = { timestamp: pt.timestamp };
    byTimestamp[pt.timestamp][pt.roomId] = pt[valueKey] as number;
  }
  return Object.values(byTimestamp).sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp))
  );
}

export function AnalyticsChart({ energyHistory, occupancyHistory }: Props) {
  const [mode, setMode] = useState<ChartMode>('energy');

  const chartData = mode === 'energy'
    ? pivotData(energyHistory, 'energyKwh')
    : pivotData(occupancyHistory, 'count');

  const isSimulated = mode === 'energy'
    ? energyHistory.some(p => p.isSimulated)
    : occupancyHistory.some(p => p.isSimulated);

  return (
    <div className="chart-container">
      <div className="section-header mb-4">
        <span className="section-title">📊 History (Last 8 Hours)</span>
        {isSimulated && <span className="badge badge--demo">⚗️ Simulated data</span>}
      </div>

      <div className="chart-tabs" role="tablist" aria-label="Chart type">
        {(['energy', 'occupancy'] as ChartMode[]).map(m => (
          <button
            key={m}
            id={`chart-tab-${m}`}
            role="tab"
            aria-selected={mode === m}
            className={`chart-tab${mode === m ? ' chart-tab--active' : ''}`}
            onClick={() => setMode(m)}
          >
            {m === 'energy' ? '⚡ Energy (kWh)' : '👥 Occupancy (people)'}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="timestamp"
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'Inter' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'Inter' }}
            axisLine={false}
            tickLine={false}
            unit={mode === 'energy' ? ' kWh' : ''}
            width={55}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'Inter',
              color: 'var(--text-primary)',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              mode === 'energy' ? `${value} kWh` : `${value} people`,
              ROOM_METADATA[String(name) as RoomId]?.name ?? String(name),
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, fontFamily: 'Inter', paddingTop: 8 }}
            formatter={(value: string) => ROOM_METADATA[value as RoomId]?.name ?? value}
          />
          {(['seminar_hall', 'classroom', 'lab', 'office'] as RoomId[]).map(id => (
            <Line
              key={id}
              type="monotone"
              dataKey={id}
              stroke={ROOM_COLORS[id]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {isSimulated && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
          Historical data shown is simulated for demonstration purposes and does not represent real measurements.
        </div>
      )}
    </div>
  );
}
