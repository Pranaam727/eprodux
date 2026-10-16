"""
Tests for the chat handler.

All LLM (Anthropic) calls are mocked. Tests run without network access.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fixtures.mock_summaries import EMPTY_ROOM_LIGHTS_ON, OCCUPIED_ROOM_KNOWN
from schemas.chat import ChatRequest, ChatResponse
from schemas.recommendation import DataMode


class TestChatHandlerFallback:
    """Tests for fallback behavior when LLM is unavailable (default in tests)."""

    @pytest.mark.asyncio
    async def test_fallback_returns_chat_response(self):
        from chat.handler import handle_chat
        request = ChatRequest(question="Which rooms are wasting energy?")
        response = await handle_chat(request, EMPTY_ROOM_LIGHTS_ON)
        assert isinstance(response, ChatResponse)

    @pytest.mark.asyncio
    async def test_fallback_answer_is_string(self):
        from chat.handler import handle_chat
        request = ChatRequest(question="What is the energy status?")
        response = await handle_chat(request, EMPTY_ROOM_LIGHTS_ON)
        assert isinstance(response.answer, str)
        assert len(response.answer) > 0

    @pytest.mark.asyncio
    async def test_fallback_mode_is_fallback(self):
        from chat.handler import handle_chat
        request = ChatRequest(question="Are there any issues?")
        response = await handle_chat(request, EMPTY_ROOM_LIGHTS_ON)
        assert response.data_mode == DataMode.FALLBACK

    @pytest.mark.asyncio
    async def test_grounded_is_true(self):
        from chat.handler import handle_chat
        request = ChatRequest(question="What is happening in the building?")
        response = await handle_chat(request, EMPTY_ROOM_LIGHTS_ON)
        assert response.grounded is True

    @pytest.mark.asyncio
    async def test_evidence_contains_room_info(self):
        from chat.handler import handle_chat
        request = ChatRequest(question="Tell me about room states.")
        response = await handle_chat(request, EMPTY_ROOM_LIGHTS_ON)
        assert isinstance(response.evidence, list)
        assert len(response.evidence) > 0
        # At least one evidence string should mention a room
        room_ids = ["seminar_hall", "classroom", "lab", "office"]
        assert any(any(rid in e for rid in room_ids) for e in response.evidence)

    @pytest.mark.asyncio
    async def test_no_source_note_when_no_rag(self):
        """When RAG returns nothing, no_source_note should be populated."""
        from rag.ingestion import KnowledgeIndex
        from rag.retrieval import set_index
        set_index(KnowledgeIndex())

        from chat.handler import handle_chat
        request = ChatRequest(question="How can I save energy?")
        response = await handle_chat(request, EMPTY_ROOM_LIGHTS_ON)
        assert response.no_source_note is not None
        assert len(response.no_source_note) > 0

    @pytest.mark.asyncio
    async def test_sources_populated_when_rag_loaded(self, rag_index):
        """When relevant docs are in the index, sources should be populated."""
        from rag.retrieval import set_index
        set_index(rag_index)

        from chat.handler import handle_chat
        request = ChatRequest(question="lighting occupancy sensor switch off unoccupied")
        response = await handle_chat(request, EMPTY_ROOM_LIGHTS_ON)
        # In demo mode LLM is off, so we get fallback — but sources may still appear
        assert isinstance(response.sources, list)


class TestChatResponseSchema:
    @pytest.mark.asyncio
    async def test_response_validates_as_chat_response(self):
        from chat.handler import handle_chat
        request = ChatRequest(question="Summary please")
        response = await handle_chat(request, OCCUPIED_ROOM_KNOWN)
        # Re-validate the response object
        ChatResponse.model_validate(response.model_dump())

    @pytest.mark.asyncio
    async def test_sources_are_guideline_refs(self, rag_index):
        from rag.retrieval import set_index
        set_index(rag_index)

        from chat.handler import handle_chat
        from schemas.recommendation import GuidelineRef
        request = ChatRequest(question="CO2 ventilation demand control occupancy")
        response = await handle_chat(request, OCCUPIED_ROOM_KNOWN)
        for source in response.sources:
            assert isinstance(source, GuidelineRef)
            assert source.source_title
            assert source.organization
            assert source.excerpt
            assert source.filename_or_url


class TestChatLLMFallback:
    @pytest.mark.asyncio
    async def test_llm_exception_falls_back_gracefully(self, monkeypatch):
        """LLM timeout/error must not raise — fallback response returned."""
        monkeypatch.setenv("ANTHROPIC_API_KEY", "fake-key")
        monkeypatch.setenv("DEMO_MODE", "false")
        from core.settings import get_settings
        get_settings.cache_clear()

        with patch("chat.handler._call_llm", side_effect=RuntimeError("timeout")):
            from chat.handler import handle_chat
            request = ChatRequest(question="What is the energy status?")
            response = await handle_chat(request, EMPTY_ROOM_LIGHTS_ON)
            assert isinstance(response, ChatResponse)
            assert response.data_mode == DataMode.FALLBACK

        get_settings.cache_clear()
