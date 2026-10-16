"""
Shared pytest fixtures and configuration.

All external calls (Anthropic API, HTTP twin backend) are mocked here
so the test suite runs entirely without network access or API keys.
"""

import os
import sys
from typing import Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Make sure 'services/genai' is on sys.path so imports resolve correctly
# ---------------------------------------------------------------------------
GENAI_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if GENAI_ROOT not in sys.path:
    sys.path.insert(0, GENAI_ROOT)

# ---------------------------------------------------------------------------
# Force demo mode for all tests (no real API calls)
# ---------------------------------------------------------------------------
os.environ.setdefault("DEMO_MODE", "true")
os.environ.setdefault("ANTHROPIC_API_KEY", "")
os.environ.setdefault("TWIN_BACKEND_URL", "http://localhost:8001")


@pytest.fixture(autouse=True)
def patch_settings(monkeypatch):
    """Ensure demo_mode=True and no real API key in every test."""
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    # Clear cached settings so each test gets a fresh instance
    from core.settings import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture()
def mock_summaries():
    """Return all three mock scenarios."""
    from fixtures.mock_summaries import ALL_SCENARIOS
    return ALL_SCENARIOS


@pytest.fixture()
def empty_room_summary():
    from fixtures.mock_summaries import EMPTY_ROOM_LIGHTS_ON
    return EMPTY_ROOM_LIGHTS_ON


@pytest.fixture()
def occupied_room_summary():
    from fixtures.mock_summaries import OCCUPIED_ROOM_KNOWN
    return OCCUPIED_ROOM_KNOWN


@pytest.fixture()
def stale_summary():
    from fixtures.mock_summaries import STALE_MISSING_DATA
    return STALE_MISSING_DATA


@pytest.fixture()
def rag_index():
    """Build a real RAG index from the synthetic test document."""
    from rag.ingestion import ingest_documents
    knowledge_dir = os.path.join(GENAI_ROOT, "rag", "knowledge")
    return ingest_documents(knowledge_dir)


@pytest.fixture()
def client_with_rag(rag_index):
    """TestClient with RAG index pre-loaded."""
    from rag.retrieval import set_index
    set_index(rag_index)

    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def client():
    """TestClient with empty RAG index (tests don't need retrieval)."""
    from rag.ingestion import KnowledgeIndex
    from rag.retrieval import set_index
    set_index(KnowledgeIndex())

    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        yield c
