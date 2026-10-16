def test_healthz_endpoint(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "eprodux-twin"
    assert data["storage"] == "in_memory"
    assert "version" in data
    assert "run_mode" in data
