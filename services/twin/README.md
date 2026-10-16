# Eprodux — Digital Twin & Backend Service

The Digital Twin service is the state coordination engine of the Eprodux platform. It maintains the real-time operational representation of the monitored university floor across its four canonical rooms.

## Architectural Ownership & Boundaries

```
Sense ──> See (Member 1: CV) ──> Twin (Member 2: Backend) ──> Think (Member 3: GenAI) ──> Act (Member 4: React UI)
```

- **Member 1 (Computer Vision)**: Ingests headcount occupancy events to `POST /api/events/cv`.
- **Member 2 (Digital Twin & Backend — This Service)**: Canonical building model, state snapshot maintenance, deduplication, camera health, manual/simulated lighting state inputs, simulated environmental data, deterministic idle-lit anomaly alerts, WebSocket broadcasting, and daily summaries.
- **Member 3 (GenAI & RAG)**: Exclusively owns recommendation generation and `GET /api/recommendations`. This twin backend does not generate recommendations or mock that endpoint.
- **Member 4 (Frontend)**: React dashboard and floor plan visualization consuming `GET /api/state` and `WS /ws/state`.

---

## Canonical Room Identifiers

The four canonical rooms are strictly:
1. `seminar_hall`: Seminar Hall ($180\text{ m}^2$, $1200\text{ W}$ lighting group)
2. `classroom`: Classroom 101 ($85\text{ m}^2$, $600\text{ W}$ lighting group)
3. `lab`: Robotics & IoT Lab ($110\text{ m}^2$, $800\text{ W}$ lighting group)
4. `office`: Faculty Office Suite ($45\text{ m}^2$, $300\text{ W}$ lighting group)

---

## Getting Started

### 1. Prerequisites & Installation

Python 3.11+ is recommended.

```bash
# From repository root
cd services/twin

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration

Copy the `.env.example` in the project root:

```bash
# Windows PowerShell
cp ../../.env.example .env
```

Available environment variables:
- `TWIN_HOST`: Default `0.0.0.0`
- `TWIN_PORT`: Default `8000`
- `TWIN_RUN_MODE`: `mock` | `live` | `replay` (default: `mock`)
- `TWIN_BUILDING_CONFIG_PATH`: Relative or absolute path to `contracts/building.json`
- `TWIN_STALE_THRESHOLD_SECONDS`: Ingestion staleness threshold (default: `30.0` seconds)
- `TWIN_IDLE_LIT_THRESHOLD_SECONDS`: Idle-lit sustained duration threshold (default: `120.0` seconds)
- `TWIN_MIN_CONFIDENCE_THRESHOLD`: Minimum CV confidence score required for anomaly alerts (default: `0.70`)

---

## Running the Service

### Start the FastAPI Server
From the repository root or `services/twin`:

```bash
# From services/twin directory:
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Or directly:
python app/main.py
```

The interactive OpenAPI Swagger UI will be available at:
`http://localhost:8000/docs`

---

## Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/healthz` | Service health status and operational mode probe |
| `GET` | `/api/state` | Validated state snapshot for all 4 rooms with per-field provenance |
| `WS` | `/ws/state` | WebSocket connection for live snapshot pushes on state change |
| `GET` | `/api/summary?period=day` | Daily summary, observation window, coverage ratio, and waste metrics |
| `POST` | `/api/events/cv` | CV occupancy event ingestion adapter (idempotent, deduplicated) |
| `POST` | `/api/events/camera-health` | Camera heartbeat and online/offline status reporting |
| `PUT` | `/api/rooms/{room_id}/lighting`| Manual or simulated lighting switch state |

---

## Running the Mock Event Generator

To test room state transitions, camera offline triggers, and idle-lit anomaly detection without physical cameras:

1. Ensure the backend is running (`http://127.0.0.1:8000`).
2. Run the script:

```bash
python scripts/mock_event_generator.py --base-url http://127.0.0.1:8000
```

The script runs an automated sequence:
- Verifies `/healthz`.
- Sets Seminar Hall lights ON and injects 0-occupant vacancy $\ge 150\text{s}$ (triggers `sustained_idle_lit` anomaly).
- Sets Classroom lights ON and injects 16 active occupants (normal active room, no alert).
- Sets Lab camera offline (immediately transitions occupancy to `unknown`).
- Sets Office to normal occupancy with simulated environmental telemetry.
- Prints the resulting `/api/state` and `/api/summary?period=day`.

---

## Running Automated Tests

Run the test suite using `pytest`:

```bash
# From repository root
python -m pytest services/twin/tests/ -v
```

The suite covers 26 test cases including:
- Health probe (`/healthz`).
- Four canonical room preservation and per-field provenance.
- Ingestion validation, unknown zone rejection, deduplication, and out-of-order rejection.
- Camera offline transitions and staleness safety bounds.
- Manual and simulated lighting state isolation.
- Deterministic idle-lit anomaly trigger and suppression gates.
- Energy calculation arithmetic and missing-wattage error handling.
- Daily summary observation window and incomplete-history flagging.
- WebSocket state push and disconnect cleanup.

---

## Architectural Progression: In-Memory to TimescaleDB & MQTT

For Checkpoint 1, the backend uses a thread-safe `InMemoryTwinRepository` behind the abstract `TwinRepository` interface (`app/repositories/base.py`).

### TimescaleDB Integration (Subsequent Milestone):
1. A new class `TimescaleTwinRepository(TwinRepository)` will implement hypertable inserts for `occupancy_events`, `lighting_events`, and room state checkpoints.
2. The `TwinService` domain logic and HTTP/WS endpoints will remain unmodified.

### MQTT Consumer Integration (Subsequent Milestone):
1. An MQTT subscriber service will subscribe to `eprodux/events/cv/+`.
2. On message receipt, the subscriber will parse the payload into `OccupancyEvent` and call `TwinService.handle_occupancy_event(event)`.
3. The identical deduplication, staleness, ordering, and anomaly evaluation logic is reused transparently.
