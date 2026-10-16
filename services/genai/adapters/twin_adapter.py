"""
Twin backend adapter.

Provides two implementations:
  MockTwinAdapter   — returns fixture summaries; used for demo/tests.
  HttpTwinAdapter   — fetches live summary from the twin backend URL.

Factory function get_twin_adapter() selects the correct implementation
based on settings.demo_mode.

INTEGRATION-TODO:
  When the twin/backend member (Member 2) finalises their API, update
  HttpTwinAdapter._parse_response() to map their schema onto TwinSummary.
  Do NOT change the TwinSummary schema itself without co-ordinating with
  Member 2 — it is the shared contract.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Optional

import httpx

from core.settings import get_settings
from fixtures.mock_summaries import EMPTY_ROOM_LIGHTS_ON, TwinSummary
from schemas.twin_summary import (
    EnergySource,
    LightingSource,
    OccupancySource,
    RoomSummary,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class TwinAdapter(ABC):
    @abstractmethod
    async def fetch_summary(self) -> TwinSummary:
        """Fetch the current twin summary."""


# ---------------------------------------------------------------------------
# Mock adapter (demo / test)
# ---------------------------------------------------------------------------

class MockTwinAdapter(TwinAdapter):
    """
    Returns a deterministic mock summary.
    The scenario can be overridden for testing.
    """

    def __init__(self, scenario: Optional[TwinSummary] = None):
        self._scenario = scenario or EMPTY_ROOM_LIGHTS_ON

    async def fetch_summary(self) -> TwinSummary:
        logger.info("MockTwinAdapter: returning mock summary (source=mock).")
        return self._scenario


# ---------------------------------------------------------------------------
# HTTP adapter (real integration)
# ---------------------------------------------------------------------------

class HttpTwinAdapter(TwinAdapter):
    """
    Fetches the twin summary from the backend service over HTTP.

    INTEGRATION-TODO: confirm endpoint, auth headers, and schema
    with Member 2 before enabling in production.
    """

    def __init__(self):
        self._settings = get_settings()

    async def fetch_summary(self) -> TwinSummary:
        url = self._settings.twin_summary_url
        try:
            async with httpx.AsyncClient(timeout=self._settings.twin_timeout_seconds) as client:
                response = client.get(url)
                response.raise_for_status()
                data = response.json()
                return self._parse_response(data)
        except httpx.HTTPError as e:
            logger.error("HttpTwinAdapter: failed to fetch from %s: %s", url, e)
            raise

    def _parse_response(self, data: dict) -> TwinSummary:
        """
        Map the twin backend JSON payload to TwinSummary.

        INTEGRATION-TODO: This is a provisional mapping assuming the backend
        returns fields matching our TwinSummary schema directly.
        Update this method when Member 2 finalises their API contract.
        """
        return TwinSummary.model_validate(data)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_twin_adapter(scenario: Optional[TwinSummary] = None) -> TwinAdapter:
    """
    Return the correct adapter based on configuration.

    Parameters
    ----------
    scenario : optional override for mock adapter (useful in tests).
    """
    settings = get_settings()
    if settings.demo_mode or not settings.llm_available:
        logger.info("Using MockTwinAdapter (demo_mode=%s).", settings.demo_mode)
        return MockTwinAdapter(scenario=scenario)

    logger.info("Using HttpTwinAdapter (twin_url=%s).", settings.twin_summary_url)
    return HttpTwinAdapter()
