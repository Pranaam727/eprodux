// ============================================================
// FloorPlan – interactive 2D SVG floor plan twin
// Shows all four rooms with live status overlays.
// ============================================================

import type { FloorState, RoomState, RoomId, LightState, ConnectionState } from '../types';

interface Props {
  floorState: FloorState | null;
  selectedRoomId: RoomId | null;
  onRoomSelect: (id: RoomId) => void;
}

// Room layout positions in SVG viewBox 0 0 800 450
const ROOM_RECTS: Record<RoomId, { x: number; y: number; w: number; h: number; label: string }> = {
  seminar_hall: { x: 40,  y: 40,  w: 340, h: 180, label: 'Seminar Hall' },
  classroom:    { x: 420, y: 40,  w: 340, h: 180, label: 'Classroom' },
  lab:          { x: 40,  y: 250, w: 340, h: 160, label: 'Laboratory' },
  office:       { x: 420, y: 250, w: 340, h: 160, label: 'Office' },
};

// Corridor / building outline
const CORRIDOR = { x: 30, y: 30, w: 740, h: 390 };

function lightColor(state: LightState, conn: ConnectionState): string {
  if (conn === 'offline') return '#1e2a40';
  if (state === 'ON')  return 'rgba(34,197,94,0.12)';
  if (state === 'OFF') return 'rgba(10,15,30,0.5)';
  return 'rgba(245,158,11,0.06)';
}

function strokeColor(state: LightState, conn: ConnectionState, selected: boolean): string {
  if (selected) return '#22c55e';
  if (conn === 'offline') return '#ef4444';
  if (state === 'ON')  return 'rgba(34,197,94,0.5)';
  if (state === 'OFF') return 'rgba(100,116,139,0.4)';
  return 'rgba(245,158,11,0.5)';
}

function occupancyLabel(room: RoomState): string {
  if (room.connectionState === 'offline') return 'UNKNOWN';
  if (room.occupancy === null) return 'UNKNOWN';
  return String(room.occupancy);
}

function lightBadgeColor(state: LightState, conn: ConnectionState): string {
  if (conn === 'offline') return '#ef4444';
  if (state === 'ON')  return '#22c55e';
  if (state === 'OFF') return '#64748b';
  return '#f59e0b';
}

export function FloorPlan({ floorState, selectedRoomId, onRoomSelect }: Props) {
  return (
    <div className="floorplan-container">
      <div className="section-header">
        <span className="section-title">🏢 Floor Twin – Floor 3</span>
        <div className="legend">
          <div className="legend-item">
            <div className="legend-swatch" style={{ background: 'rgba(34,197,94,0.4)', border: '1px solid #22c55e' }} />
            <span>Lights ON</span>
          </div>
          <div className="legend-item">
            <div className="legend-swatch" style={{ background: 'rgba(100,116,139,0.3)', border: '1px solid #64748b' }} />
            <span>Lights OFF</span>
          </div>
          <div className="legend-item">
            <div className="legend-swatch" style={{ background: 'rgba(245,158,11,0.3)', border: '1px solid #f59e0b' }} />
            <span>Light Unknown</span>
          </div>
          <div className="legend-item">
            <div className="legend-swatch" style={{ background: 'rgba(239,68,68,0.3)', border: '1px solid #ef4444' }} />
            <span>Offline</span>
          </div>
          <div className="legend-item" style={{ marginLeft: 8 }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Click a room for details</span>
          </div>
        </div>
      </div>

      <div className="floorplan-svg-wrap">
        <svg
          viewBox="0 0 800 450"
          width="100%"
          height="100%"
          role="img"
          aria-label="Interactive floor plan of Floor 3 with four rooms"
          style={{ display: 'block' }}
        >
          {/* Building outline */}
          <rect
            x={CORRIDOR.x} y={CORRIDOR.y} width={CORRIDOR.w} height={CORRIDOR.h}
            rx={12} ry={12}
            fill="rgba(17,24,39,0.8)"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />

          {/* Corridor label */}
          <text x={400} y={230} textAnchor="middle" fill="rgba(255,255,255,0.12)"
            fontSize={11} fontFamily="Inter, sans-serif" letterSpacing={6}>
            CORRIDOR
          </text>

          {/* Rooms */}
          {(Object.entries(ROOM_RECTS) as [RoomId, typeof ROOM_RECTS[RoomId]][]).map(([id, rect]) => {
            const room = floorState?.rooms[id];
            const isSelected = selectedRoomId === id;
            const conn: ConnectionState = room?.connectionState ?? 'unknown';
            const lightState = room?.lightState ?? 'UNKNOWN';
            const hasAlert = conn === 'offline' || (room?.occupancy === 0 && lightState === 'ON');

            return (
              <g
                key={id}
                className={`room-shape${isSelected ? ' room-selected' : ''}`}
                onClick={() => onRoomSelect(id)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onRoomSelect(id)}
                tabIndex={0}
                role="button"
                aria-label={`${rect.label}: ${occupancyLabel(room!)} occupants, lights ${lightState}`}
                aria-pressed={isSelected}
              >
                {/* Room background */}
                <rect
                  className="room-bg"
                  x={rect.x} y={rect.y} width={rect.w} height={rect.h}
                  rx={8} ry={8}
                  fill={lightColor(lightState, conn)}
                  stroke={strokeColor(lightState, conn, isSelected)}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />

                {/* Alert hatch pattern for critical rooms */}
                {hasAlert && (
                  <rect
                    x={rect.x} y={rect.y} width={rect.w} height={4}
                    fill={conn === 'offline' ? '#ef4444' : '#f59e0b'}
                    rx={8} ry={0}
                    opacity={0.7}
                  />
                )}

                {/* Room name */}
                <text
                  x={rect.x + rect.w / 2} y={rect.y + 30}
                  textAnchor="middle"
                  fill="#f1f5f9"
                  fontSize={13}
                  fontWeight={700}
                  fontFamily="Inter, sans-serif"
                >
                  {rect.label}
                </text>

                {/* Occupancy */}
                <text
                  x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 - 14}
                  textAnchor="middle"
                  fill={conn === 'offline' ? '#ef4444' : '#f1f5f9'}
                  fontSize={conn === 'offline' || room?.occupancy === null ? 16 : 36}
                  fontWeight={800}
                  fontFamily="Inter, sans-serif"
                >
                  {occupancyLabel(room!)}
                </text>
                <text
                  x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 + 8}
                  textAnchor="middle"
                  fill="rgba(241,245,249,0.5)"
                  fontSize={9}
                  fontFamily="Inter, sans-serif"
                >
                  {conn === 'offline' ? 'CAMERA OFFLINE' : 'occupants (CV estimated)'}
                </text>

                {/* Light state badge */}
                <rect
                  x={rect.x + rect.w / 2 - 36} y={rect.y + rect.h - 38}
                  width={72} height={20}
                  rx={10} ry={10}
                  fill={`${lightBadgeColor(lightState, conn)}22`}
                  stroke={`${lightBadgeColor(lightState, conn)}66`}
                  strokeWidth={1}
                />
                <text
                  x={rect.x + rect.w / 2} y={rect.y + rect.h - 24}
                  textAnchor="middle"
                  fill={lightBadgeColor(lightState, conn)}
                  fontSize={9}
                  fontWeight={700}
                  fontFamily="Inter, sans-serif"
                  letterSpacing={0.5}
                >
                  {`💡 ${lightState} (manual)`}
                </text>

                {/* Energy reading */}
                {room?.energyKwh != null && (
                  <text
                    x={rect.x + rect.w - 10} y={rect.y + 20}
                    textAnchor="end"
                    fill="rgba(56,189,248,0.8)"
                    fontSize={9}
                    fontFamily="Inter, sans-serif"
                  >
                    ⚡ {room.energyKwh} kWh
                  </text>
                )}

                {/* CO₂ reading */}
                {room?.co2Ppm != null && (
                  <text
                    x={rect.x + 10} y={rect.y + 20}
                    fill="rgba(34,197,94,0.7)"
                    fontSize={9}
                    fontFamily="Inter, sans-serif"
                  >
                    🌿 {room.co2Ppm} ppm
                  </text>
                )}

                {/* Data source label */}
                <text
                  x={rect.x + rect.w / 2} y={rect.y + rect.h - 10}
                  textAnchor="middle"
                  fill="rgba(100,116,139,0.5)"
                  fontSize={7.5}
                  fontFamily="Inter, sans-serif"
                  letterSpacing={1}
                >
                  {room?.dataSource?.toUpperCase() ?? 'UNKNOWN'} DATA
                </text>
              </g>
            );
          })}

          {/* Compass rose */}
          <text x={768} y={418} fontSize={8} fill="rgba(255,255,255,0.2)" fontFamily="Inter, sans-serif">N↑</text>

          {/* Scale label */}
          <line x1={60} y1={428} x2={160} y2={428} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
          <text x={110} y={440} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.2)" fontFamily="Inter, sans-serif">~10 m</text>
        </svg>
      </div>
    </div>
  );
}
