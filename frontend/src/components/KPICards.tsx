// ============================================================
// KPICards – floor-level summary metrics
// ============================================================

import type { FloorState, Alert } from '../types';

interface Props {
  floorState: FloorState | null;
  activeAlerts: Alert[];
  potentialSavingsKwh: number;
}

export function KPICards({ floorState, activeAlerts, potentialSavingsKwh }: Props) {
  const cards = [
    {
      id: 'kpi-occupancy',
      icon: '👥',
      label: 'Total Occupancy',
      value: floorState?.totalOccupancy != null
        ? String(floorState.totalOccupancy)
        : 'UNKNOWN',
      unit: floorState?.totalOccupancy != null ? 'people (partial – office offline)' : 'camera offline',
      colorClass: floorState?.totalOccupancy != null ? 'kpi-value--blue' : 'kpi-value--muted',
    },
    {
      id: 'kpi-energy',
      icon: '⚡',
      label: 'Est. Energy Use',
      value: floorState?.totalEnergyKwh != null
        ? floorState.totalEnergyKwh.toFixed(1)
        : '—',
      unit: 'kWh · simulated',
      colorClass: 'kpi-value--yellow',
    },
    {
      id: 'kpi-co2',
      icon: '🌿',
      label: 'Avg CO₂',
      value: floorState?.avgCo2Ppm != null
        ? String(Math.round(floorState.avgCo2Ppm))
        : '—',
      unit: 'ppm · simulated',
      colorClass: floorState?.avgCo2Ppm != null && floorState.avgCo2Ppm > 600
        ? 'kpi-value--yellow'
        : 'kpi-value--green',
    },
    {
      id: 'kpi-alerts',
      icon: '🔔',
      label: 'Active Alerts',
      value: String(activeAlerts.length),
      unit: `${activeAlerts.filter(a => a.severity === 'critical').length} critical`,
      colorClass: activeAlerts.some(a => a.severity === 'critical')
        ? 'kpi-value--red'
        : activeAlerts.length > 0 ? 'kpi-value--yellow' : 'kpi-value--green',
    },
    {
      id: 'kpi-savings',
      icon: '💰',
      label: 'Potential Savings',
      value: potentialSavingsKwh.toFixed(1),
      unit: 'kWh · modeled projection',
      colorClass: 'kpi-value--green',
    },
  ];

  return (
    <div className="kpi-grid" role="region" aria-label="Key performance indicators">
      {cards.map(card => (
        <div key={card.id} id={card.id} className="kpi-card" role="article">
          <div className="kpi-icon" aria-hidden="true">{card.icon}</div>
          <div className="kpi-label">{card.label}</div>
          <div className={`kpi-value ${card.colorClass}`} aria-label={`${card.label}: ${card.value}`}>
            {card.value}
          </div>
          <div className="kpi-unit">{card.unit}</div>
        </div>
      ))}
    </div>
  );
}
