# Eprodux — GenAI Service (Member 3)

Generative AI service for **Eprodux**, an IoT digital twin for sustainable university building management.

Position in the locked Eprodux pipeline:
$$\text{Sense} \longrightarrow \text{See (CV)} \longrightarrow \text{Twin (Backend)} \longrightarrow \mathbf{Think\ (GenAI)} \longrightarrow \text{Act (Dashboard)}$$

The GenAI service consumes digital twin summaries and outputs:
1. **Grounded energy-efficiency recommendations** with deterministic savings calculations.
2. **Context-aware chat responses** grounded in building state and sustainability knowledge passages.
3. **Traceable RAG citations** referencing only indexed guideline documents.
4. **Offline demo mode & deterministic fallback engine** guaranteeing uninterrupted hackathon presentations without network or live Claude API keys.

---

## Table of Contents

- [Service Architecture & Boundaries](#service-architecture--boundaries)
- [Directory Layout](#directory-layout)
- [Technology Choices](#technology-choices)
- [Configuration & Environment Variables](#configuration--environment-variables)
- [Endpoints & API Contracts](#endpoints--api-contracts)
  - [`GET /health`](#get-health)
  - [`GET /api/recommendations`](#get-apirecommendations)
  - [`POST /api/recommendations`](#post-apirecommendations)
  - [`POST /api/chat`](#post-apichat)
- [Deterministic Savings Module](#deterministic-savings-module)
- [Safety & Verification Rules](#safety--verification-rules)
- [RAG Ingestion & Sustainability Knowledge](#rag-ingestion--sustainability-knowledge)
- [Demo Scenarios & Fallback Mode](#demo-scenarios--fallback-mode)
- [Setup & Local Run Instructions](#setup--local-run-instructions)
- [Running Tests](#running-tests)
- [Docker Deployment](#docker-deployment)
- [Twin/Backend Integration Assumptions & Checklist](#twinbackend-integration-assumptions--checklist)

---

## Service Architecture & Boundaries

### What the GenAI Service DOES NOT do:
- **No CV or occupancy detection**: Computer vision models and camera feeds belong exclusively to the CV service (Member 1).
- **Not the source of truth for state**: The digital twin/backend (Member 2) is the authoritative source for occupancy, lighting states, and meter readings.
- **No direct hardware control**: The service never actuates relays, lights, or HVAC directly; it produces recommendations for human operators or building managers via the dashboard (Member 4).
- **No LLM math**: The LLM is prohibited from calculating numeric savings; all savings numbers are calculated by deterministic Python functions.
- **No fabricated data or citations**: Real sensor data is strictly segregated from simulated data; if an input or citation is missing, the service explicitly states so.

### What the GenAI Service DOES:
- Ingests typed `TwinSummary` objects representing the university floor's 4 rooms (`seminar_hall`, `classroom`, `lab`, `office`).
- Generates prioritised recommendations and grounded answers.
- Retrieves sustainability guidance from local TF-IDF indexed documents.
- Evaluates recommendations against hard deterministic safety rules.
- Computes savings deterministically ($kWh$, $\text{INR}$, $kg\ \text{CO}_2$).
- Provides complete offline fallback mode when the LLM API is unavailable.

---

## Directory Layout

```
services/genai/
├── app/
│   ├── routes/
│   │   ├── chat.py             # POST /api/chat route
│   │   ├── health.py           # GET /health dependency probe
│   │   └── recommendations.py  # GET & POST /api/recommendations routes
│   └── main.py                 # FastAPI application factory and lifespan
├── adapters/
│   └── twin_adapter.py         # MockTwinAdapter & HttpTwinAdapter
├── chat/
│   └── handler.py              # Grounded Q&A logic with evidence formatting
├── core/
│   ├── logging_config.py       # Formatted logging setup
│   ├── room_config.py          # Room IDs, display names, and power baselines
│   └── settings.py             # Pydantic BaseSettings configuration
├── fixtures/
│   ├── demo_responses.py       # Pre-computed deterministic fallback responses
│   └── mock_summaries.py       # 3 test scenarios (empty lit room, occupied, stale)
├── rag/
│   ├── knowledge/
│   │   └── synthetic_test_guide.txt # Synthetic test guideline document
│   ├── ingestion.py            # Text chunking, TF-IDF vectorization & persistence
│   └── retrieval.py            # Cosine-similarity retrieval and citation formatting
├── recommendations/
│   ├── fallback.py             # Rule-based offline recommendation engine
│   ├── generator.py            # LLM prompt builder, parser, and orchestrator
│   ├── safety.py               # Deterministic safety rule catalogue
│   └── savings.py              # Pure Python deterministic savings calculations
├── schemas/
│   ├── chat.py                 # ChatRequest, ChatResponse
│   ├── health.py               # HealthResponse
│   ├── recommendation.py       # Recommendation, RecommendationResponse, GuidelineRef
│   └── twin_summary.py         # TwinSummary, RoomSummary, and source Enums
├── tests/
│   ├── conftest.py             # Pytest fixtures and mock client
│   ├── test_api.py             # Endpoint tests (health, recs, chat, openapi)
│   ├── test_chat.py            # Chat handler and fallback tests
│   ├── test_rag.py             # Ingestion, TF-IDF retrieval, citation tests
│   ├── test_recommendations.py # LLM parser, mock LLM generation, fallback tests
│   ├── test_safety.py          # Safety rule rejection unit tests
│   ├── test_savings.py         # Deterministic savings math & boundary tests
│   └── test_scenarios.py       # End-to-end testing of 3 demo scenarios
├── .env.example                # Template environment variables (no secrets)
├── Dockerfile                  # Container build specification
├── pytest.ini                  # Pytest configuration
├── requirements.txt            # Locked Python dependencies
└── README.md                   # This documentation
```

---

## Technology Choices

- **Python**: 3.11+
- **FastAPI**: Asynchronous HTTP framework with OpenAPI documentation.
- **Pydantic v2**: Strict schema validation and serialization for inputs and outputs.
- **Anthropic Python SDK**: Official SDK for Claude API structured generation.
- **Scikit-Learn & NumPy**: Lightweight TF-IDF vector space model for local RAG retrieval (offline-capable, no vector DB required).
- **Pytest & Pytest-Asyncio**: Comprehensive test suite covering units, schemas, safety rules, and endpoints.
- **HTTPX**: Non-blocking client for twin backend communication.

---

## Configuration & Environment Variables

Copy `.env.example` to `.env` to configure the service. Real keys must never be committed to version control.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8002` | Port on which the FastAPI server listens. |
| `LOG_LEVEL` | `INFO` | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |
| `DEMO_MODE` | `true` | When `true`, uses mock twin data and offline deterministic responses. |
| `ANTHROPIC_API_KEY` | *(empty)* | Claude API key. If unset or blank, service automatically operates in fallback mode. |
| `CLAUDE_MODEL` | `claude-3-5-haiku-20241022` | Anthropic model identifier. |
| `LLM_TIMEOUT_SECONDS` | `15.0` | Timeout for Claude API calls. |
| `LLM_MAX_RETRIES` | `2` | Bounded retries before triggering deterministic fallback. |
| `TWIN_BACKEND_URL` | `http://localhost:8001` | Base URL of the Member 2 digital twin backend. |
| `TWIN_SUMMARY_PATH`| `/api/twin/summary` | Endpoint path on twin backend returning `TwinSummary`. |
| `TWIN_TIMEOUT_SECONDS`| `5.0` | Timeout when fetching live twin summaries. |
| `TARIFF_INR_PER_KWH` | `8.0` | Default university campus electricity tariff ($\text{INR}/\text{kWh}$). |
| `EMISSIONS_FACTOR_KG_PER_KWH` | `0.82` | India CEA average grid carbon intensity ($kg\ \text{CO}_2/\text{kWh}$). |
| `KNOWLEDGE_DIR` | `rag/knowledge` | Path to directory containing `.txt` and `.md` guideline documents. |
| `RAG_TOP_K` | `3` | Maximum number of guideline passages retrieved per query. |

---

## Endpoints & API Contracts

### `GET /health`
Returns service status, dependency reachability, and demo configuration without exposing secrets or credentials.

#### Sample Request:
```bash
curl http://localhost:8002/health
```

#### Sample Response:
```json
{
  "status": "ok",
  "service": "eprodux-genai",
  "version": "0.1.0",
  "demo_mode": true,
  "llm_available": false,
  "twin_backend_available": false,
  "rag_index_loaded": true
}
```

---

### `GET /api/recommendations`
Fetches the current building twin summary (from the twin backend or mock fixture in demo mode) and returns validated recommendations with deterministic savings.

#### Sample Request:
```bash
curl http://localhost:8002/api/recommendations
```

#### Sample Response:
```json
{
  "recommendations": [
    {
      "id": "76ec961b",
      "issue": "Lighting left on in unoccupied Seminar Hall",
      "location": "seminar_hall",
      "evidence": "Lighting is ON (source: simulated). Occupancy: 0 confirmed (source: simulated). Waste hours: 2.0 h.",
      "action": "Switch off lighting in Seminar Hall immediately.",
      "priority": "high",
      "kWh_saved": 3.2,
      "cost_saved": 25.6,
      "co2_saved": 2.624,
      "cost_saved_inr": 25.6,
      "co2_saved_kg": 2.624,
      "guideline_ref": null,
      "confidence": "high",
      "data_mode": "fallback",
      "savings_assumptions": "Illustrative estimate. Assumptions: power=2.0 kW, avoidable_hours=2.0 h, savings_fraction=0.8, tariff=₹8.0/kWh, emissions_factor=0.82 kg CO2/kWh. Not a measured or guaranteed saving."
    }
  ],
  "data_mode": "fallback",
  "total_kwh_saved": 3.2,
  "total_cost_saved": 25.6,
  "total_co2_saved": 2.624,
  "total_cost_saved_inr": 25.6,
  "total_co2_saved_kg": 2.624,
  "warnings": []
}
```

---

### `POST /api/recommendations`
Processes a caller-supplied `TwinSummary` JSON payload directly. Used for integration testing and pipeline validation.

#### Sample Request:
```bash
curl -X POST http://localhost:8002/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "period_start": "2024-10-15T08:00:00Z",
    "period_end": "2024-10-15T10:00:00Z",
    "data_freshness_minutes": 5.0,
    "missing_data_warnings": [],
    "summary_source": "test_caller",
    "rooms": [
      {
        "room_id": "seminar_hall",
        "occupancy_count": 0,
        "occupancy_known": true,
        "occupancy_source": "simulated",
        "lighting_on": true,
        "lighting_source": "simulated",
        "energy_kwh": 4.0,
        "energy_source": "simulated",
        "waste_hours": 2.0
      }
    ]
  }'
```

---

### `POST /api/chat`
Answers natural language questions about building energy and room status, grounded in twin data and retrieved guideline passages.

#### Sample Request:
```bash
curl -X POST http://localhost:8002/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "Which rooms are wasting energy right now?"}'
```

#### Sample Response:
```json
{
  "answer": "Based on the available building data (simulated demo mode), the Seminar Hall currently has lighting switched on with zero confirmed occupants. This represents an avoidable energy waste of approximately 3.2 kWh over 2 hours, equivalent to ₹25.60 and 2.6 kg CO₂. The Classroom, Lab, and Office all have lighting off and show normal consumption. Note: all values are illustrative estimates from simulated data.",
  "evidence": [
    "seminar_hall: occupancy=known count=0, lighting=ON, energy=4.0 kWh, co2=420.0 ppm",
    "classroom: occupancy=known count=0, lighting=OFF, energy=0.5 kWh, co2=415.0 ppm",
    "lab: occupancy=known count=0, lighting=OFF, energy=2.5 kWh, co2=None ppm",
    "office: occupancy=known count=0, lighting=OFF, energy=0.2 kWh, co2=None ppm"
  ],
  "sources": [],
  "data_mode": "fallback",
  "grounded": true,
  "no_source_note": "No relevant guideline source was found for this question. The answer is based solely on the twin summary data."
}
```

---

## Deterministic Savings Module

Numeric savings are strictly calculated in Python (`recommendations/savings.py`) using established engineering formulas. Any savings estimates produced by an LLM are discarded server-side.

### Mathematical Formulation
$$\text{kWh\_saved} = P_{\text{device}} \times t_{\text{avoidable}} \times f_{\text{savings}}$$
$$\text{cost\_saved} = \text{kWh\_saved} \times \text{Tariff}_{\text{INR}}$$
$$\text{co2\_saved} = \text{kWh\_saved} \times \text{EF}_{\text{grid}}$$

### Default Parameters (Configurable)
- **Lighting Power Baseline**:
  - `seminar_hall`: $2.0\ \text{kW}$ ($\sim 20 \times 100\ \text{W}$ fixtures)
  - `classroom`: $1.2\ \text{kW}$ ($\sim 15 \times 80\ \text{W}$ fixtures)
  - `lab`: $1.5\ \text{kW}$
  - `office`: $0.8\ \text{kW}$
- **Savings Fraction ($f_{\text{savings}}$)**: $0.8$ ($80\%$ of waste hours assumed realistically recoverable via automation).
- **Electricity Tariff**: $\text{₹}8.00\ /\ \text{kWh}$.
- **Grid Carbon Factor**: $0.82\ kg\ \text{CO}_2\ /\ \text{kWh}$ (CEA India grid baseline).

### Missing Data & Auditability
- If `power_kw` or `avoidable_hours` is `None` or negative, `kWh_saved`, `cost_saved`, and `co2_saved` evaluate to `None`. No synthetic numbers are fabricated.
- Every calculation returns a `savings_assumptions` audit trail string detailing all factors and stating that the figure is an estimate, not a guaranteed measurement.

---

## Safety & Verification Rules

Every proposed recommendation (from the LLM or fallback rules) passes through hard deterministic safety checks (`recommendations/safety.py`) before dispatch:

- **RULE-01 (Occupant Safety)**: Suppresses "switch off lights" whenever confirmed room occupancy is $> 0$.
- **RULE-02 (Uncertainty Gate)**: Blocks automated control recommendations when occupancy is unknown (`occupancy_known=False`). Emits a **verification action** instead.
- **RULE-03 (Life Safety)**: Blocks any action referencing emergency egress, exit, evacuation, or fire lighting systems.
- **RULE-04 (Critical Assets)**: Prohibits power-off recommendations for laboratory equipment (fume hoods, biological safety cabinets, incubators, autoclaves) or server racks.
- **RULE-05 (Data Integrity)**: Prohibits quantitative savings claims if both meter data (`energy_kwh`) and `waste_hours` are absent.
- **RULE-06 (Prompt Injection Defense)**: Retrieved guideline text and user questions are treated strictly as untrusted data/evidence and never injected into system instructions.

---

## RAG Ingestion & Sustainability Knowledge

The RAG system (`rag/ingestion.py` and `rag/retrieval.py`) indexes sustainability guidance documents from `rag/knowledge/`.

1. **Lightweight & Fully Offline**: Uses TF-IDF vectorization with bi-grams and cosine similarity from Scikit-Learn.
2. **Metadata Tracking**: Every indexed chunk tracks `source_title`, `organization`, and `filename`.
3. **No Fabricated Citations**: If no passage scores above the relevance threshold, `sources` is empty and `no_source_note` is populated. The model never hallucinates an author or regulation.
4. **Synthetic Test Guide**: A clearly marked test document `synthetic_test_guide.txt` is provided for testing.
5. **Adding Authorized Guidance Later**: To incorporate official ECBC, BEE, or ASHRAE standards, place licensed `.txt` or `.md` files into `rag/knowledge/`. On service startup, the index is automatically rebuilt and cached in `rag/.index_cache`.

---

## Demo Scenarios & Fallback Mode

The service includes 3 predefined scenarios in `fixtures/mock_summaries.py` for testing and offline demonstration:

1. **`EMPTY_ROOM_LIGHTS_ON`**:
   - Seminar hall is vacant (`occupancy=0`, confirmed) with lights left ON for 2 hours.
   - Result: High-priority recommendation to switch off lights with $\approx 3.2\ \text{kWh}$ savings estimate.
2. **`OCCUPIED_ROOM_KNOWN`**:
   - Classroom occupied by 12 people with elevated $\text{CO}_2$ ($1050\ \text{ppm}$).
   - Result: No lights-off recommendation; generates ventilation adjustment guidance.
3. **`STALE_MISSING_DATA`**:
   - Data age is $90\ \text{minutes}$, office occupancy is unknown, and lab meter is offline.
   - Result: Emits stale data warning and requests verification; suppresses savings calculations.

---

## Setup & Local Run Instructions

### 1. Prerequisites
- Python 3.11+
- Virtual environment tool (`venv`)

### 2. Installation
```bash
# Navigate to the GenAI service directory
cd services/genai

# Create and activate virtual environment
python -m venv .venv

# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Configuration
```bash
cp .env.example .env
# Edit .env if you wish to configure a Claude API key or backend URL.
# By default DEMO_MODE=true runs offline without any external keys.
```

### 4. Start the Service
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```
Interactive API docs are available at `http://localhost:8002/docs`.

---

## Running Tests

The test suite contains 130 tests covering endpoints, safety rules, deterministic savings math, RAG retrieval, scenarios, and schema contracts.

Run the tests using pytest:

```bash
# Set PYTHONPATH to the service root and run tests
$env:PYTHONPATH="services/genai"; python -m pytest services/genai/tests
```

All external HTTP and Anthropic API calls are mocked; the test suite executes in $\approx 25$ seconds without network access.

---

## Docker Deployment

Build and run the standalone container:

```bash
# Build the Docker image
docker build -t eprodux-genai services/genai

# Run container in demo mode (port 8002)
docker run -d -p 8002:8002 -e DEMO_MODE=true --name eprodux-genai-service eprodux-genai
```

Test container health:
```bash
curl http://localhost:8002/health
```

---

## Twin/Backend Integration Assumptions & Checklist

For Member 2 (Digital Twin / Backend owner):

### Integration Questions & Assumptions:
1. **Endpoint Contract**: We assume the twin backend exposes `GET /api/twin/summary` returning the JSON structure modeled in `schemas/twin_summary.py:TwinSummary`.
2. **Canonical Room IDs**: We have provisionally defined 4 rooms:
   - `seminar_hall`
   - `classroom`
   - `lab`
   - `office`
   *Confirmation needed*: Are these the exact string IDs used by the backend and database?
3. **Data Quality Indicators**: The GenAI service expects `occupancy_known: bool` and `occupancy_source: "cv" | "manual" | "simulated" | "unknown"`.
4. **Adapter Customization**: If the twin backend JSON payload differs, only `adapters/twin_adapter.py:HttpTwinAdapter._parse_response` needs to be updated to map fields onto `TwinSummary`.
5. **No Direct Device Control**: The GenAI service outputs actionable suggestions to the dashboard; it does not issue actuation commands back to the twin backend.
