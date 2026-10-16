// ============================================================
// DigitalTwinPage.tsx — Dedicated 3D Digital Twin View
// Interactive 3D Model, Filters, Legend, 2D Fallback & Room Inspection
// ============================================================

import { useState } from 'react';
import type { FloorState, Alert, Recommendation, RoomId } from '../../types';
import { DigitalTwin3D } from '../DigitalTwin3D';
import { FloorPlan } from '../FloorPlan';
import { RoomDetailPanel } from '../RoomDetailPanel';

interface Props {
  floorState: FloorState | null;
  alerts: Alert[];
  recommendations: Recommendation[];
  selectedRoomId: RoomId | null;
  onRoomSelect: (roomId: RoomId | null) => void;
}

export function DigitalTwinPage({
  floorState,
  alerts,
  recommendations,
  selectedRoomId,
  onRoomSelect,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'occupied' | 'lights_on' | 'waste_alert'>('all');
  const [viewFormat, setViewFormat] = useState<'3d' | '2d'>('3d');

  const selectedRoom = selectedRoomId && floorState ? floorState.rooms[selectedRoomId] : null;

  // Filtered rooms logic
  const rooms = floorState ? Object.values(floorState.rooms) : [];
  const filteredRooms = rooms.filter((r) => {
    if (filter === 'occupied') return (r.occupancy ?? 0) > 0;
    if (filter === 'lights_on') return r.lightState === 'ON';
    if (filter === 'waste_alert') return r.occupancy === 0 && r.lightState === 'ON';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── TOP CONTROL & FILTER BAR ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 20px',
        }}
      >
        {/* Left: View Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>VIEW MODE:</span>
          <div className="chart-tabs" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={`chart-tab ${viewFormat === '3d' ? 'chart-tab--active' : ''}`}
              onClick={() => setViewFormat('3d')}
            >
              🏢 3D Architectural
            </button>
            <button
              type="button"
              className={`chart-tab ${viewFormat === '2d' ? 'chart-tab--active' : ''}`}
              onClick={() => setViewFormat('2d')}
            >
              📐 2D Schematics
            </button>
          </div>
        </div>

        {/* Right: Quick State Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>FILTER:</span>
          {(
            [
              { id: 'all', label: 'All Rooms (4)' },
              { id: 'occupied', label: 'Occupied' },
              { id: 'lights_on', label: 'Lights ON' },
              { id: 'waste_alert', label: '⚠️ Waste Alert' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              className={`btn btn--sm ${filter === f.id ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3D / 2D CANVAS CONTAINER ── */}
      <div style={{ position: 'relative' }}>
        {viewFormat === '3d' ? (
          <DigitalTwin3D
            floorState={floorState}
            selectedRoomId={selectedRoomId}
            onRoomSelect={(id) => onRoomSelect(selectedRoomId === id ? null : id)}
            height={560}
          />
        ) : (
          <FloorPlan
            floorState={floorState}
            selectedRoomId={selectedRoomId}
            onRoomSelect={(id) => onRoomSelect(selectedRoomId === id ? null : id)}
          />
        )}
      </div>

      {/* ── SELECTED ROOM DETAIL DRAWER ── */}
      {selectedRoom && (
        <RoomDetailPanel
          room={selectedRoom}
          alerts={alerts}
          recommendations={recommendations}
          onClose={() => onRoomSelect(null)}
        />
      )}

      {/* ── FOUR CANONICAL ROOMS CARDS GRID ── */}
      <div>
        <div className="section-title" style={{ marginBottom: 12 }}>
          CANONICAL CAMPUS ZONES ({filteredRooms.length} MATCHING)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {filteredRooms.map((room) => {
            const isSelected = selectedRoomId === room.id;
            const isOffline = room.connectionState === 'offline';
            const isWaste = room.occupancy === 0 && room.lightState === 'ON';

            return (
              <div
                key={room.id}
                className={`card ${isSelected ? 'card--accent' : ''}`}
                style={{
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(34, 197, 94, 0.08)' : 'var(--bg-card)',
                  border: `1px solid ${
                    isSelected ? 'var(--accent-green)' : isWaste ? 'rgba(245, 158, 11, 0.5)' : 'var(--border-card)'
                  }`,
                }}
                onClick={() => onRoomSelect(room.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{room.name}</h4>
                    <span className="font-mono text-xs text-muted">ID: {room.id}</span>
                  </div>
                  <span
                    className={`status-dot status-dot--${
                      isOffline ? 'offline' : room.lightState === 'ON' ? 'on' : 'off'
                    }`}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, margin: '10px 0' }}>
                  <div className="card card--compact" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-xs text-muted">HEADCOUNT (CV)</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                      {isOffline ? (
                        <span style={{ color: 'var(--alert-critical)' }}>OFFLINE</span>
                      ) : room.occupancy !== null ? (
                        room.occupancy
                      ) : (
                        'UNKNOWN'
                      )}
                    </div>
                  </div>
                  <div className="card card--compact" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-xs text-muted">LIGHTING (MANUAL)</div>
                    <div
                      style={{
                        fontSize: '1.2rem',
                        fontWeight: 800,
                        color: room.lightState === 'ON' ? 'var(--accent-green)' : 'var(--text-secondary)',
                      }}
                    >
                      {room.lightState}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.70rem',
                    color: 'var(--text-secondary)',
                    padding: '6px 8px',
                    background: 'var(--bg-surface)',
                    borderRadius: 4,
                  }}
                >
                  <span>⚡ {room.energyKwh !== null ? `${room.energyKwh} kWh` : 'Simulated'}</span>
                  <span>🌿 {room.co2Ppm !== null ? `${room.co2Ppm} ppm` : 'Simulated'}</span>
                  <span>🌡️ {room.temperatureC !== null ? `${room.temperatureC}°C` : 'Simulated'}</span>
                </div>

                {isWaste && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: '0.70rem',
                      color: 'var(--alert-warning)',
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ Waste: Lighting ON with zero occupancy
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
