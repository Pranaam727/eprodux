# Eprodux

> **A university-building digital twin for sustainable energy and resource management combining computer vision, digital twin state management, generative AI recommendations, and an interactive real-time dashboard.**

---

## 1. Locked Architecture & Scope

$$\text{Sense} \longrightarrow \text{See (Computer Vision)} \longrightarrow \text{Twin (Backend)} \longrightarrow \mathbf{Think\ (GenAI)} \longrightarrow \text{Act (Dashboard)}$$

- **Scope**: Exactly one university building floor (Floor 3) with four canonical rooms:
  1. `seminar_hall` (Seminar Hall)
  2. `classroom` (Classroom 101)
  3. `lab` (Robotics & IoT Lab)
  4. `office` (Faculty Office Suite)
- **Computer Vision (See)**: Video replay / RTSP streams detect occupant headcounts in real-time.
- **Digital Twin (Twin)**: Authoritative state engine, event ingestion, idle-lit anomaly detection, and state broadcasting.
- **Generative AI (Think)**: RAG sustainability knowledge retrieval, deterministic savings estimates, safety rules, grounded recommendations, and chat assistant.
- **Dashboard (Act)**: Interactive 2D floor plan, telemetry KPI strip, What-If simulator, and recommendation actions.
- **Data Provenance**: Real sensor data is explicitly distinguished from simulated inputs. Lighting state is labeled as manual input. Missing camera data is flagged as `UNKNOWN` (never coerced to 0).

---

## 2. Team Responsibilities

| Role | Member | Responsibilities | Status |
| :--- | :--- | :--- | :--- |
| **Sense & See** | Member 1 | Computer vision pipeline, video replay, occupancy detection, event publishing to `/api/events/cv`. | ✅ Complete (`cv`) |
| **Twin & Backend** | Member 2 | State engine, building model, `/api/summary`, idle-lit anomalies, WebSocket broadcasting (`ws://.../ws`). | ✅ Complete (`services/twin`) |
| **Think** | Member 3 | GenAI service, RAG pipeline, deterministic savings, safety checks, `/api/recommendations`, `/api/chat`. | ✅ Complete (`services/genai`) |
| **Act** | Member 4 | React 19 + Vite dashboard, 2D interactive floor plan, What-If simulator, alert & recommendation panels. | ✅ Complete (`frontend`) |

---

## 3. Repository Structure

```
eprodux/
├── contracts/                  # Canonical shared contracts & schemas
│   ├── building.json           # Floor and four-room definition
│   └── schemas/                # Machine-readable JSON Schemas
│       ├── occupancy_event.schema.json
│       ├── lighting_input.schema.json
│       ├── camera_health_input.schema.json
│       ├── building_state.schema.json
│       └── daily_summary.schema.json
├── cv/                         # Member 1 — Computer Vision Pipeline
│   ├── config/                 # YAML configuration (cv.example.yaml)
│   ├── src/                    # Video source, YOLO detector, occupancy, health, publisher
│   ├── tests/                  # Automated unit/integration test suite
│   ├── requirements.txt
│   └── README.md
├── docs/                       # Shared architecture and API documentation
│   └── API_CONTRACTS.md        # Canonical API contracts source of truth
├── frontend/                   # Member 4 — React 19 + TypeScript + Vite Dashboard
│   ├── src/                    # Floor plan, KPI cards, simulator, charts, chat
│   ├── package.json
│   └── README.md
├── services/
│   ├── twin/                   # Member 2 — Digital Twin & Backend service (Port 8000)
│   │   ├── app/                # FastAPI application, models, services, repositories
│   │   ├── scripts/            # Mock event generator script
│   │   ├── tests/              # 26 automated unit/integration tests
│   │   ├── requirements.txt
│   │   └── README.md
│   └── genai/                  # Member 3 — Generative AI & Recommendations (Port 8002)
│       ├── app/                # FastAPI application & routes (/health, /api/recommendations, /api/chat)
│       ├── rag/                # Sustainability guidance ingestion & TF-IDF retrieval
│       ├── recommendations/    # Deterministic savings math & safety rule engine
│       ├── tests/              # 130 automated unit/integration tests
│       ├── requirements.txt
│       ├── Dockerfile
│       └── README.md
├── .env.example                # Example environment configuration
├── .gitignore                  # Unified git ignore rules
└── README.md                   # This project README
```

---

## 4. Quickstart — Running the Services

### A. Frontend Dashboard (Port 5173)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.  
*(Demo mode is enabled by default with simulated data and offline capabilities).*

### B. Digital Twin Backend (Port 8000)
```bash
cd services/twin
pip install -r requirements.txt
python -m pytest tests/ -v
python app/main.py
```
Open API docs at [http://localhost:8000/docs](http://localhost:8000/docs).  
To generate mock telemetry events in a separate terminal:
```bash
python scripts/mock_event_generator.py --base-url http://127.0.0.1:8000
```

### C. Generative AI Service (Port 8002)
```bash
cd services/genai
pip install -r requirements.txt
$env:PYTHONPATH="services/genai"; python -m pytest tests/ -v
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```
Open API docs at [http://localhost:8002/docs](http://localhost:8002/docs).

### D. Computer Vision Occupancy Pipeline
```bash
cd cv
pip install -r requirements.txt
python -m pytest tests/ -v
python src/main.py --config config/cv.example.yaml
```
See [`cv/README.md`](cv/README.md) for full pipeline parameters and demo video ingestion instructions.

---

## 5. Canonical Room IDs

| ID | Display Name | Power Baseline (kW) | Notes |
|---|---|---|---|
| `seminar_hall` | Seminar Hall | 2.0 | Large space, lighting waste scenario |
| `classroom` | Classroom 101 | 1.2 | High occupancy, CO₂ monitoring |
| `lab` | Robotics & IoT Lab | 1.5 | Safety-critical equipment (fume hood/server racks) |
| `office` | Faculty Office Suite | 0.8 | Camera-offline scenario (`UNKNOWN` occupancy) |

---

## 6. Data Honesty & Provenance Commitments

| Data Type | Label | Policy |
|---|---|---|
| Camera occupancy | "CV estimated" | Sourced from real video; never coerced to 0 if camera is offline. |
| Lighting state | "manual input" | Manually supplied or simulated (not inferred from camera). |
| Meter / CO₂ / Temp | "simulated" | Clearly tagged with provenance `"simulated"`. |
| Recommendation savings | "modeled projection" | Pure Python deterministic calculations; LLM arithmetic is discarded. |
| Simulator outputs | "illustrative estimates" | Based on explicit campus tariff (₹8/kWh) and CEA carbon factor (0.82 kg CO₂/kWh). |
