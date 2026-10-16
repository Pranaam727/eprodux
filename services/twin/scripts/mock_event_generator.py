#!/usr/bin/env python3
"""
Eprodux Mock Event Generator Script.
Publishes deterministic test events against a running Eprodux Digital Twin service.

Scenarios demonstrated:
1. Seminar Hall: 0 occupants, lights ON, sustained vacancy -> triggers idle-lit alert.
2. Classroom: 15 occupants, lights ON -> normal active occupancy.
3. Lab: camera offline heartbeat -> occupancy status transitions to UNKNOWN.
4. Office: 2 occupants, lights ON -> normal active occupancy.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone, timedelta


def make_request(method: str, url: str, payload: dict = None) -> dict:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    data_bytes = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"[ERROR] HTTP {e.code} on {method} {url}: {err_body}", file=sys.stderr)
        raise
    except urllib.error.URLError as e:
        print(f"[ERROR] Connection failed to {url}: {e.reason}", file=sys.stderr)
        raise


def run_scenario(base_url: str):
    print("=" * 70)
    print(" EPRODUX DIGITAL TWIN — MOCK EVENT GENERATOR SCENARIO")
    print(f" Target Service: {base_url}")
    print("=" * 70)

    # 1. Check health
    health_url = f"{base_url}/healthz"
    print(f"\n[1/6] Verifying service health via GET {health_url}...")
    health = make_request("GET", health_url)
    print(f"  -> Health OK: {health}")

    now = datetime.now(timezone.utc)

    # 2. Setup Room 1: Seminar Hall (Idle-Lit Condition)
    print("\n[2/6] Configuring Seminar Hall (Expect Idle-Lit Anomaly)...")
    # Turn lights ON manually
    sh_light = {
        "room_id": "seminar_hall",
        "timestamp": now.isoformat(),
        "light_state": "on",
        "source": "manual",
    }
    make_request("PUT", f"{base_url}/api/rooms/seminar_hall/lighting", sh_light)
    print("  -> Lighting set: ON (source: manual)")

    # Send camera online heartbeat
    make_request(
        "POST",
        f"{base_url}/api/events/camera-health",
        {
            "room_id": "seminar_hall",
            "timestamp": now.isoformat(),
            "status": "online",
            "source": "mock",
        },
    )

    # Ingest baseline CV event with 0 occupants to start vacancy clock
    make_request(
        "POST",
        f"{base_url}/api/events/cv",
        {
            "event_id": f"mock_sh_init_{uuid.uuid4().hex[:8]}",
            "zone_id": "seminar_hall",
            "timestamp": now.isoformat(),
            "occupancy": 0,
            "confidence": 0.95,
            "source": "mock",
        },
    )

    # Ingest sustained vacancy event (+150s later) exceeding the 120s idle-lit threshold
    sustained_time = now + timedelta(seconds=150)
    sh_event = {
        "event_id": f"mock_sh_sustained_{uuid.uuid4().hex[:8]}",
        "zone_id": "seminar_hall",
        "timestamp": sustained_time.isoformat(),
        "occupancy": 0,
        "confidence": 0.95,
        "source": "mock",
    }
    res_sh = make_request("POST", f"{base_url}/api/events/cv", sh_event)
    print(f"  -> Sustained CV Vacancy Event (+150s) Ingested: {res_sh}")

    # 3. Setup Room 2: Classroom (Occupied, No Alert)
    print("\n[3/6] Configuring Classroom (Expect Normal Active Occupancy)...")
    make_request(
        "PUT",
        f"{base_url}/api/rooms/classroom/lighting",
        {
            "room_id": "classroom",
            "timestamp": now.isoformat(),
            "light_state": "on",
            "source": "manual",
        },
    )
    cr_event = {
        "event_id": f"mock_cr_{uuid.uuid4().hex[:8]}",
        "zone_id": "classroom",
        "timestamp": now.isoformat(),
        "occupancy": 16,
        "confidence": 0.94,
        "source": "mock",
    }
    res_cr = make_request("POST", f"{base_url}/api/events/cv", cr_event)
    print(f"  -> CV Occupancy Event Ingested: {res_cr}")

    # 4. Setup Room 3: Lab (Camera Offline -> UNKNOWN Occupancy)
    print("\n[4/6] Configuring Lab (Expect Camera Offline & Occupancy UNKNOWN)...")
    lab_health = {
        "room_id": "lab",
        "timestamp": now.isoformat(),
        "status": "offline",
        "source": "mock_monitor",
    }
    res_lab = make_request("POST", f"{base_url}/api/events/camera-health", lab_health)
    print(f"  -> Camera Health Ingested: {res_lab}")

    # 5. Setup Room 4: Office (Normal Occupancy)
    print("\n[5/6] Configuring Office (Expect 2 Occupants)...")
    make_request(
        "PUT",
        f"{base_url}/api/rooms/office/lighting",
        {
            "room_id": "office",
            "timestamp": now.isoformat(),
            "light_state": "on",
            "source": "manual",
        },
    )
    off_event = {
        "event_id": f"mock_off_{uuid.uuid4().hex[:8]}",
        "zone_id": "office",
        "timestamp": now.isoformat(),
        "occupancy": 2,
        "confidence": 0.89,
        "source": "mock",
    }
    res_off = make_request("POST", f"{base_url}/api/events/cv", off_event)
    print(f"  -> CV Occupancy Event Ingested: {res_off}")

    # 6. Verify State Snapshot
    print("\n[6/6] Fetching Final Twin Snapshot via GET /api/state...")
    state = make_request("GET", f"{base_url}/api/state")
    print("\n=== CURRENT ROOM SNAPSHOTS ===")
    for room in state.get("rooms", []):
        anomalies = [a.get("rule_id") for a in room.get("anomalies", [])]
        print(
            f"  [{room['room_id']}] name={room['name']} | "
            f"occupancy={room['occupancy']} ({room['occupancy_status']}) | "
            f"light={room['light_state']} | "
            f"cam={room['camera_status']} | "
            f"anomalies={anomalies}"
        )

    # 7. Verify Summary
    summary = make_request("GET", f"{base_url}/api/summary?period=day")
    print("\n=== DAILY SUMMARY METRICS ===")
    metrics = summary.get("metrics", {})
    print(f"  Total Waste Hours: {metrics.get('total_waste_hours')} hrs")
    print(f"  Total Waste kWh:   {metrics.get('total_estimated_waste_kwh')} kWh")
    print(f"  Completeness:      {summary.get('completeness_status')}")
    print(f"  Data Quality:      {summary.get('data_quality_notes')}")
    print("\nScenario execution finished successfully.")


def main():
    parser = argparse.ArgumentParser(description="Eprodux Digital Twin Mock Event Generator")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Base URL of twin backend")
    args = parser.parse_args()

    try:
        run_scenario(args.base_url)
    except Exception as e:
        print(f"\nExecution failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
