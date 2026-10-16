import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure twin package is in python search path
twin_root = Path(__file__).resolve().parent.parent
if str(twin_root) not in sys.path:
    sys.path.insert(0, str(twin_root))

from app.api.routes import get_twin_service
from app.main import app
from app.repositories.memory import InMemoryTwinRepository
from app.services.twin_service import TwinService


@pytest.fixture
def fresh_repo():
    return InMemoryTwinRepository()


@pytest.fixture
def fresh_service(fresh_repo):
    return TwinService(repository=fresh_repo)


@pytest.fixture
def client(fresh_service):
    app.dependency_overrides[get_twin_service] = lambda: fresh_service
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
