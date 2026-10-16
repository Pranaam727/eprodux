def test_summary_period_day(client):
    resp = client.get("/api/summary?period=day")
    assert resp.status_code == 200
    data = resp.json()

    assert data["period"] == "day"
    assert "generated_at" in data

    # Provenance verification
    prov = data["provenance"]
    assert prov["storage"] == "in_memory"
    assert prov["is_mock_data"] is True

    # Incomplete history verification
    obs = data["observation_window"]
    assert "duration_seconds" in obs
    assert "coverage_ratio_24h" in obs

    # Coverage for initial startup is well below 1.0, must NOT be presented as complete
    assert obs["coverage_ratio_24h"] < 1.0
    assert data["completeness_status"] in ("incomplete", "insufficient_data")

    # Notes explicitly flag incomplete history
    notes_joined = " ".join(data["data_quality_notes"])
    assert "incomplete" in notes_joined.lower() or "prototype" in notes_joined.lower()

    # Metrics
    metrics = data["metrics"]
    assert "total_waste_hours" in metrics
    assert "total_estimated_waste_kwh" in metrics
    assert len(metrics["rooms"]) == 4


def test_summary_invalid_period(client):
    # Only period=day is currently supported
    resp = client.get("/api/summary?period=month")
    assert resp.status_code == 422
