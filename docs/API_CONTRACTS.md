# Eprodux — API & Event Contracts (Source of Truth)

## 1. System Architecture & Role Boundaries

Eprodux follows the locked architecture:
$$\text{Sense} \longrightarrow \text{See (CV)} \longrightarrow \text{Twin (Backend)} \longrightarrow \text{Think (GenAI)} \longrightarrow \text{Act (Dashboard)}$$

### Team Responsibilities & Ownership
- **Member 1 (Computer Vision)**: Occupancy tracking, bounding boxes/counts from recorded video or RTSP, publishing validated CV events to `/api/events/cv`.
- **Member 2 (Digital Twin & Backend Foundation - This Service)**: Canonical building model, state snapshot maintenance, event deduplication & ordering, camera health tracking, manual/simulated lighting inputs, simulated environmental data, deterministic idle-lit anomaly detection, WebSocket live broadcast, and `/api/summary`.
- **Member 3 (GenAI & RAG)**: Recommendation generation and recommendation validation. **Member 3 exclusively owns `GET /api/recommendations`**. Member 2 does not implement fake GenAI or mock recommendations.
- **Member 4 (Frontend)**: React dashboard, interactive floor plan, WebSocket listener, manual lighting toggles, and anomaly alert views.

---

## 2. Canonical Room & Zone Identifiers

Across all services, databases, events, and UI components, the four canonical room identifiers are:

| Room ID | Canonical Display Name | Room Type | Default Lighting Rated Power ($W$) |
| :--- | :--- | :--- | :--- |
| `seminar_hall` | Seminar Hall | `auditorium` | $1200\text{ W}$ |
| `classroom` | Classroom 101 | `classroom` | $600\text{ W}$ |
| `lab` | Robotics & IoT Lab | `laboratory` | $800\text{ W}$ |
| `office` | Faculty Office Suite | `office` | $300\text{ W}$ |

Any event referencing an unrecognized room ID is rejected with HTTP `422 Unprocessable Entity` or `400 Bad Request`.

---

## 3. Approved Architecture Decisions

> [!IMPORTANT]
> **Decoupled Lighting Decision**:
> In earlier design drafts, lighting state was considered inside the CV event. The approved project architecture strictly decouples them:
> 1. Computer Vision does **NOT** detect lighting.
> 2. Lighting state is ingested **only** via manual user input (`PUT /api/rooms/{room_id}/lighting`) or simulated test feeds.
> 3. The occupancy event schema contains **no** `light_state` field.

> [!NOTE]
> **Environmental & Meter Readings**:
> Meter, $\text{CO}_2$, and temperature readings are simulated in this prototype and explicitly tagged with provenance `"simulated"`.

> [!NOTE]
> **Persistence & Transport Roadmap**:
> Checkpoint 1 uses a thread-safe, in-memory repository implementing the `TwinRepository` interface. Subsequent checkpoints will attach TimescaleDB (PostgreSQL) and MQTT consumers to the same underlying `TwinService` domain logic without changing external contracts.

---

## 4. Ingestion Contracts

### A. Computer Vision Occupancy Event
- **Endpoint**: `POST /api/events/cv`
- **Schema Reference**: [`contracts/schemas/occupancy_event.schema.json`](../contracts/schemas/occupancy_event.schema.json)
- **Description**: Ingests occupant headcounts computed by the CV pipeline.

#### Request Payload
```json
{
  "event_id": "evt_550e8400-e29b-41d4-a716-446655440000",
  "zone_id": "classroom",
  "timestamp": "2026-10-15T12:00:00Z",
  "occupancy": 14,
  "confidence": 0.94,
  "source": "recorded-video"
}
```

#### Field Specifications
- `event_id` (string, required): Unique event UUID. Incoming events with an already-processed `event_id` are acknowledged idempotently without double-processing.
- `zone_id` (string, required): One of `["seminar_hall", "classroom", "lab", "office"]`.
- `timestamp` (string, ISO 8601 with timezone, required): Time frame was analyzed. Out-of-order events older than the current room event timestamp are discarded.
- `occupancy` (integer, $\ge 0$, required): Integer headcount.
- `confidence` (float $0.0 - 1.0$, optional): Detection confidence.
- `source` (string, required): `"recorded-video"`, `"webcam"`, `"rtsp"`, or `"mock"`.

#### Responses
- `200 OK`: `{"status": "accepted", "event_id": "...", "room_id": "classroom", "deduplicated": false}`
- `422 / 400 Bad Request`: Validation failure or unknown `zone_id`.

---

### B. Manual / Simulated Lighting Input
- **Endpoint**: `PUT /api/rooms/{room_id}/lighting`
- **Schema Reference**: [`contracts/schemas/lighting_input.schema.json`](../contracts/schemas/lighting_input.schema.json)
- **Description**: Updates the digital-twin lighting state representation. Does not issue physical hardware control commands.

#### Request Payload
```json
{
  "room_id": "seminar_hall",
  "timestamp": "2026-10-15T12:05:00Z",
  "light_state": "on",
  "source": "manual"
}
```

#### Field Specifications
- `room_id` (string, required): Canonical room identifier.
- `timestamp` (string, ISO 8601 with timezone, required): When the switch state was asserted.
- `light_state` (string, required): `"on"`, `"off"`, or `"unknown"`.
- `source` (string, required): `"manual"`, `"simulated"`, or `"unknown"`.

---

### C. Camera Health & Stream Status
- **Endpoint**: `POST /api/events/camera-health`
- **Schema Reference**: [`contracts/schemas/camera_health_input.schema.json`](../contracts/schemas/camera_health_input.schema.json)
- **Description**: Explicit heartbeat or offline signal from the video ingestion pipeline.

#### Request Payload
```json
{
  "room_id": "lab",
  "timestamp": "2026-10-15T12:05:00Z",
  "status": "offline",
  "source": "cv_agent"
}
```

#### Safety Behavior
- When `status == "offline"`, the room's `camera_status` immediately transitions to `"offline"`, and `occupancy_status` transitions to `"unknown"` (`occupancy` set to `null`).
- When a camera is online but no fresh CV event has arrived within `cv_stale_threshold_seconds` (default: 30s), the twin automatically transitions `camera_status` to `"stale"`, setting `occupancy` to `null` and `occupancy_status` to `"unknown"`.

---

## 5. Query & Streaming Contracts

### A. Health Check
- **Endpoint**: `GET /healthz`
- **Description**: Service liveness and readiness probe.
```json
{
  "status": "healthy",
  "service": "eprodux-twin",
  "version": "0.1.0",
  "run_mode": "mock",
  "storage": "in_memory"
}
```

---

### B. Digital Twin State Snapshot
- **Endpoint**: `GET /api/state`
- **Schema Reference**: [`contracts/schemas/building_state.schema.json`](../contracts/schemas/building_state.schema.json)
- **Description**: Complete state snapshot of all 4 canonical rooms with granular per-field provenance.

#### Response Example
```json
{
  "building_id": "eprodux_bldg_01",
  "floor_id": "floor_01",
  "updated_at": "2026-10-15T12:10:00Z",
  "run_mode": "mock",
  "rooms": [
    {
      "room_id": "seminar_hall",
      "name": "Seminar Hall",
      "occupancy": 0,
      "occupancy_status": "known",
      "confidence": 0.95,
      "light_state": "on",
      "light_source": "manual",
      "camera_status": "online",
      "last_event_at": "2026-10-15T12:05:00Z",
      "vacancy_seconds": 300.0,
      "environmental_data": {
        "temperature_c": 21.8,
        "relative_humidity_pct": 48.0,
        "co2_ppm": 440.0,
        "provenance": "simulated"
      },
      "energy_data": {
        "estimated_current_power_w": 1200.0,
        "provenance": "simulated",
        "calculation_basis": "rated_lighting_power"
      },
      "provenance": {
        "occupancy": "recorded-video",
        "lighting": "manual",
        "camera_health": "heartbeat",
        "environment": "simulated",
        "energy": "simulated"
      },
      "anomalies": [
        {
          "rule_id": "sustained_idle_lit",
          "severity": "warning",
          "message": "Room has been verified vacant for 300.0s with lights ON.",
          "raised_at": "2026-10-15T12:10:00Z",
          "evidence": {
            "room_id": "seminar_hall",
            "vacancy_seconds": 300.0,
            "threshold_seconds": 120.0,
            "light_state": "on",
            "rated_power_w": 1200.0
          }
        }
      ]
    }
  ]
}
```

---

### C. Live State WebSocket
- **Endpoint**: `WS /ws/state`
- **Protocol**: Standard WebSocket.
- **Behavior**:
  1. On connection established, server immediately emits the current `BuildingStateSnapshot`.
  2. Whenever an occupancy event, lighting toggle, or camera health event updates the room state, an updated `BuildingStateSnapshot` JSON string is broadcast to all active clients.
  3. Disconnections are handled gracefully without impacting backend HTTP endpoints.

---

### D. Daily Summary & Aggregates
- **Endpoint**: `GET /api/summary?period=day`
- **Schema Reference**: [`contracts/schemas/daily_summary.schema.json`](../contracts/schemas/daily_summary.schema.json)
- **Description**: Returns observed waste duration and energy impact. Explicitly reports observation window and coverage ratio.

#### Response Example
```json
{
  "period": "day",
  "generated_at": "2026-10-15T12:15:00Z",
  "provenance": {
    "mode": "mock",
    "storage": "in_memory",
    "is_mock_data": true
  },
  "observation_window": {
    "start_time": "2026-10-15T12:00:00Z",
    "end_time": "2026-10-15T12:15:00Z",
    "duration_seconds": 900.0,
    "coverage_ratio_24h": 0.0104
  },
  "completeness_status": "incomplete",
  "data_quality_notes": [
    "Observation window covers 0.25 hours of 24-hour target (1.0% coverage).",
    "Prototype session using in-memory mock repository; results reflect active session only."
  ],
  "metrics": {
    "total_waste_hours": 0.0833,
    "total_estimated_waste_kwh": 0.1,
    "rooms": [
      {
        "room_id": "seminar_hall",
        "name": "Seminar Hall",
        "observed_seconds": 900.0,
        "waste_hours": 0.0833,
        "estimated_waste_kwh": 0.1,
        "utilization_rate": 0.0,
        "anomalies_detected": [ ... ]
      }
    ]
  }
}
```

---

## 6. Deterministic Anomaly Rules

### Sustained Idle-Lit Anomaly (`sustained_idle_lit`)
Calculates whether energy is being wasted due to lights remaining illuminated in an empty room.

#### Alert Trigger Gate (ALL must be true):
1. Room `occupancy_status == "known"`.
2. Latest observed `occupancy == 0`.
3. Camera status is `"online"` and observation is fresh ($t_{\text{now}} - t_{\text{event}} < t_{\text{stale}}$).
4. Detection confidence $\ge \text{confidence\_threshold}$ (default: $0.70$).
5. `light_state == "on"`.
6. `vacancy_seconds` $\ge \text{idle\_lit\_threshold\_seconds}$ (default: $120.0\text{ s}$).

#### Alert Suppression Gate (ANY will suppress):
- `occupancy > 0` (people present).
- `occupancy_status == "unknown"`.
- Camera is `"offline"` or `"stale"`.
- `light_state` is `"off"` or `"unknown"`.
- Confidence or data coverage is insufficient.

---

## 7. Energy Calculation Model

Energy is calculated using deterministic arithmetic:
$$\text{energy\_kwh} = \frac{\text{power\_w} \times \text{duration\_hours}}{1000} = \frac{\text{power\_w} \times (\text{duration\_seconds} / 3600)}{1000}$$

Rules:
- Validated numeric inputs only ($\text{power\_w} \ge 0$, $\text{duration} \ge 0$).
- When power rating is `null`, energy calculation returns `null` or raises an explicit validation exception; **no default wattage is silently fabricated**.
