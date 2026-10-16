# Eprodux

> **A digital twin of a university building floor that combines computer vision and generative AI to identify sustainability opportunities and recommend improvements.**

---

## 1. Locked Architecture & Scope

$$\text{Sense} \longrightarrow \text{See (Computer Vision)} \longrightarrow \text{Twin (Backend)} \longrightarrow \text{Think (GenAI)} \longrightarrow \text{Act (Dashboard)}$$

- **Scope**: Exactly one university building floor with four canonical rooms:
  1. `seminar_hall` (Seminar Hall)
  2. `classroom` (Classroom 101)
  3. `lab` (Robotics & IoT Lab)
  4. `office` (Faculty Office Suite)
- **Computer Vision**: Real recorded video replay or live RTSP streams detect occupant headcounts.
- **Lighting**: Lighting state is supplied manually or simulated (Computer Vision does **NOT** detect lighting).
- **Environment & Meters**: CO₂, temperature, humidity, and energy meters are simulated and explicitly labelled with provenance `"simulated"`.
- **Recommendations**: GenAI recommendations are advisory only; no direct HVAC or physical equipment control.

---

## 2. Team Responsibilities

| Role | Member | Responsibilities |
| :--- | :--- | :--- |
| **Sense & See** | Member 1 | Computer vision pipeline, video replay, occupancy tracking, publishing CV events to `/api/events/cv`. |
| **Twin & Backend** | Member 2 | Digital twin state engine, building model, event handling, safety rules, idle-lit anomaly detection, WebSocket broadcasting, and `/api/summary`. |
| **Think** | Member 3 | GenAI, RAG pipeline, recommendation generation and validation. **Member 3 exclusively owns `GET /api/recommendations`**. |
| **Act** | Member 4 | React frontend, interactive floor plan, live telemetry dashboards, and manual lighting controls. |

---

## 3. Repository Structure

```
├── contracts/                  # Canonical shared contracts & schemas
│   ├── building.json           # Four-room building & floor definition
│   └── schemas/                # Machine-readable JSON Schemas
│       ├── occupancy_event.schema.json
│       ├── lighting_input.schema.json
│       ├── camera_health_input.schema.json
│       ├── building_state.schema.json
│       └── daily_summary.schema.json
├── docs/                       # Shared architecture and API documentation
│   └── API_CONTRACTS.md        # Canonical API contracts source of truth
├── services/
│   ├── twin/                   # Digital Twin & Backend service (Member 2)
│   │   ├── app/                # FastAPI application, models, services, repositories
│   │   ├── scripts/            # Mock event generator script
│   │   ├── tests/              # Automated test suite (26 passing tests)
│   │   ├── requirements.txt
│   │   └── README.md
│   └── genai/                  # Generative AI & Recommendations (Member 3)
│       ├── app/                # FastAPI application & routes (/health, /api/recommendations, /api/chat)
│       ├── rag/                # Sustainability guidance ingestion & TF-IDF retrieval
│       ├── recommendations/    # Deterministic savings & safety rule engine
│       ├── tests/              # Automated test suite (130 passing tests)
│       ├── requirements.txt
│       └── README.md
├── .env.example                # Example environment configuration
└── README.md
```

---

## 4. Quickstart — Running Services

### Digital Twin Backend (Port 8000)
```bash
cd services/twin
pip install -r requirements.txt
python -m pytest tests/ -v
python app/main.py
```
Open [http://localhost:8000/docs](http://localhost:8000/docs) in your browser.

In a separate terminal, to generate mock telemetry events:
```bash
python scripts/mock_event_generator.py --base-url http://127.0.0.1:8000
```

### Generative AI Service (Port 8002)
```bash
cd services/genai
pip install -r requirements.txt
$env:PYTHONPATH="services/genai"; python -m pytest tests/ -v
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```
Open [http://localhost:8002/docs](http://localhost:8002/docs) in your browser.