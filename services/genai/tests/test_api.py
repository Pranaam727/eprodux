"""
FastAPI endpoint integration tests.

Uses FastAPI TestClient — no real network, no API keys required.
All external calls (Anthropic, twin backend) are handled by demo mode / mock adapter.
"""

import json
import pytest
from fastapi.testclient import TestClient


class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_response_schema(self, client):
        response = client.get("/health")
        data = response.json()
        assert "status" in data
        assert "service" in data
        assert "version" in data
        assert "demo_mode" in data
        assert "llm_available" in data
        assert "twin_backend_available" in data
        assert "rag_index_loaded" in data

    def test_health_status_ok(self, client):
        response = client.get("/health")
        assert response.json()["status"] == "ok"

    def test_health_demo_mode_true(self, client):
        response = client.get("/health")
        assert response.json()["demo_mode"] is True

    def test_health_llm_not_available_without_key(self, client):
        """Without API key, llm_available must be False."""
        response = client.get("/health")
        assert response.json()["llm_available"] is False

    def test_health_no_secrets_in_response(self, client):
        """Response must not contain the word 'key' or 'secret'."""
        response = client.get("/health")
        body = response.text.lower()
        assert "api_key" not in body
        assert "anthropic_api" not in body


class TestRecommendationsGetEndpoint:
    def test_recommendations_returns_200(self, client):
        response = client.get("/api/recommendations")
        assert response.status_code == 200

    def test_recommendations_response_has_list(self, client):
        response = client.get("/api/recommendations")
        data = response.json()
        assert "recommendations" in data
        assert isinstance(data["recommendations"], list)

    def test_recommendations_data_mode_present(self, client):
        response = client.get("/api/recommendations")
        data = response.json()
        assert "data_mode" in data
        assert data["data_mode"] in ("live", "mock", "fallback")

    def test_each_recommendation_has_required_fields(self, client):
        response = client.get("/api/recommendations")
        for rec in response.json()["recommendations"]:
            assert "id" in rec
            assert "issue" in rec
            assert "location" in rec
            assert "evidence" in rec
            assert "action" in rec
            assert "priority" in rec
            assert "kWh_saved" in rec
            assert "cost_saved" in rec
            assert "co2_saved" in rec
            assert "confidence" in rec
            assert "data_mode" in rec

    def test_recommendations_priority_valid(self, client):
        response = client.get("/api/recommendations")
        for rec in response.json()["recommendations"]:
            assert rec["priority"] in ("high", "medium", "low")

    def test_savings_non_negative_when_present(self, client):
        response = client.get("/api/recommendations")
        for rec in response.json()["recommendations"]:
            if rec.get("kWh_saved") is not None:
                assert rec["kWh_saved"] >= 0
            if rec.get("cost_saved_inr") is not None:
                assert rec["cost_saved_inr"] >= 0
                assert rec["cost_saved"] == rec["cost_saved_inr"]
            if rec.get("co2_saved_kg") is not None:
                assert rec["co2_saved_kg"] >= 0
                assert rec["co2_saved"] == rec["co2_saved_kg"]


class TestRecommendationsPostEndpoint:
    def test_post_with_valid_summary(self, client, empty_room_summary):
        payload = empty_room_summary.model_dump(mode="json")
        response = client.post("/api/recommendations", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "recommendations" in data

    def test_post_with_occupied_summary(self, client, occupied_room_summary):
        payload = occupied_room_summary.model_dump(mode="json")
        response = client.post("/api/recommendations", json=payload)
        assert response.status_code == 200

    def test_post_with_stale_summary(self, client, stale_summary):
        payload = stale_summary.model_dump(mode="json")
        response = client.post("/api/recommendations", json=payload)
        assert response.status_code == 200

    def test_post_with_invalid_body_returns_422(self, client):
        response = client.post("/api/recommendations", json={"invalid": "payload"})
        assert response.status_code == 422


class TestChatEndpoint:
    def test_chat_returns_200(self, client):
        response = client.post(
            "/api/chat",
            json={"question": "Which rooms have lights on?"},
        )
        assert response.status_code == 200

    def test_chat_response_schema(self, client):
        response = client.post("/api/chat", json={"question": "What is the energy status?"})
        data = response.json()
        assert "answer" in data
        assert "evidence" in data
        assert "sources" in data
        assert "data_mode" in data
        assert "grounded" in data

    def test_chat_answer_is_non_empty(self, client):
        response = client.post("/api/chat", json={"question": "Summary please"})
        assert len(response.json()["answer"]) > 0

    def test_chat_empty_question_returns_422(self, client):
        response = client.post("/api/chat", json={"question": ""})
        assert response.status_code == 422

    def test_chat_grounded_true(self, client):
        response = client.post("/api/chat", json={"question": "Tell me about room energy"})
        assert response.json()["grounded"] is True

    def test_chat_with_supplied_context(self, client, empty_room_summary):
        """Caller can supply context directly — adapter not called."""
        payload = {
            "question": "Is the seminar hall occupied?",
            "context": empty_room_summary.model_dump(mode="json"),
        }
        response = client.post("/api/chat", json=payload)
        assert response.status_code == 200
        assert response.json()["answer"]


class TestOpenAPISchema:
    def test_openapi_json_accessible(self, client):
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert "paths" in schema
        assert "/health" in schema["paths"]
        assert "/api/recommendations" in schema["paths"]
        assert "/api/chat" in schema["paths"]
