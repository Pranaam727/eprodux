# CV Component — Eprodux

Computer Vision occupancy monitoring for the Eprodux digital twin.

## What this component does

- Reads a recorded video file frame-by-frame (no full-video buffering).
- Detects people using a YOLO model (YOLOv8n by default).
- Tracks detections across frames using ByteTrack (via Ultralytics).
- Maps tracked people to configurable room zones using polygon membership.
- Applies temporal stabilization to reduce count flickering.
- Publishes JSON occupancy events for downstream consumption.
- Monitors its own health and never reports a stale zero when the video source fails.

## Lighting state

**Lighting is manually supplied** via the scenario configuration file or CLI argument.
The CV component does **not** detect light state from image brightness or any other image feature.
Supported values: `on`, `off`, `unknown`.

## Confidence field

The `confidence` field in published events is defined as:

> The fraction of frames in the stabilization window that agreed on the published occupancy count.

This is a **count-stability score**, not a statistically calibrated probability of the true occupancy.
A value of `1.0` means all recent frames agreed; `0.5` means only half agreed.

## Privacy guarantees

- Frames are processed locally and never stored or transmitted.
- No face recognition, identity matching, or identity tracking is performed.
- Tracker IDs are ephemeral and reset between runs.

---

## Directory layout

```
cv/
├── README.md               ← this file
├── requirements.txt
├── config/
│   └── cv.example.yaml     ← annotated example configuration
└── src/
    ├── config.py           ← YAML config loader and validator
    ├── video_source.py     ← VideoSource with health state machine
    ├── detector.py         ← YOLO person-detection wrapper
    ├── tracker.py          ← ByteTrack wrapper (via Ultralytics)
    ├── zones.py            ← Normalized-polygon zone membership
    ├── occupancy.py        ← Temporal stabilization (sliding-window mode)
    ├── event_schema.py     ← CVEvent dataclass and JSON serialization
    ├── publisher.py        ← Publisher interface + Stdout / File publishers
    ├── health.py           ← Camera health state machine
    └── main.py             ← Pipeline entry point (CLI)
```

---

## Quick start

### 1. Install dependencies

```bash
cd cv
pip install -r requirements.txt
```

### 2. Obtain YOLO model weights

The default model is **YOLOv8n** (Ultralytics). Download it once:

```bash
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```

The weights file (`yolov8n.pt`) will be downloaded to `~/.cache/ultralytics/` or the current
directory. **Do not commit this file** — it is covered by `.gitignore`.

Alternatively, set `model.weights` in your config to any local `.pt` path.

### 3. Create your local config

```bash
cp cv/config/cv.example.yaml cv/config/cv.yaml
# Edit cv/config/cv.yaml — set video_source.path to your recorded video file
```

### 4. Run the CV pipeline

```bash
python -m cv.src.main --config cv/config/cv.yaml
```

Optional overrides:

```bash
# Override video path on the command line
python -m cv.src.main --config cv/config/cv.yaml --video path/to/video.mp4

# Pretty-print events to stdout without a config file (uses built-in defaults)
python -m cv.src.main --video path/to/video.mp4 --publisher stdout
```

### 5. Run tests

```bash
cd cv
pytest tests/ -v
```

---

## Example published event

```json
{
  "zone_id": "seminar_hall",
  "timestamp": "2026-10-15T10:30:00Z",
  "occupancy": 3,
  "light_state": "on",
  "confidence": 0.875
}
```

---

## Zone calibration

Zones are defined as polygons in **normalized [0, 1] coordinates** (x, y relative to frame
width and height). To calibrate zones for your footage:

1. Pause the video on a representative frame.
2. Note the pixel coordinates of the four corners of each room zone.
3. Divide x-coordinates by frame width and y-coordinates by frame height.
4. Enter the resulting `[[x1,y1],[x2,y2],...]` lists under `zones[*].polygon` in your config.

Zones must not overlap. The component logs a warning if polygon validation detects issues.

A person is assigned to a zone based on the **bottom-center** of their bounding box.
If that point falls outside all zones, the person is not counted in any room.

---

## Integration dependencies (unresolved)

The following decisions are pending coordination with other team members:

| # | Item | Status |
|---|------|--------|
| 1 | Backend / MQTT publish endpoint | ⏳ Awaiting Member 2 |
| 2 | Shared building config JSON (canonical room IDs) | ⏳ Will auto-load if placed at `building.json` in repo root |
| 3 | Camera-health event schema for cross-service propagation | ⏳ Proposed; not yet in shared contract |
| 4 | Docker Compose service definition for CV | ⏳ Awaiting overall infra decision |

Until the backend is ready, use `publisher: stdout` or `publisher: file` in your config.

---

## Evaluation procedure (real-video validation)

> These steps require actual demo footage and are **not part of automated tests**.

### Frame labeling
1. Extract ~100 representative frames: `ffmpeg -i video.mp4 -vf fps=0.1 frames/frame_%04d.png`
2. Label each frame with ground-truth occupancy per room (CSV format).

### Metrics
- **MAE** (Mean Absolute Error): `mean(|predicted_occupancy - ground_truth|)` per room.
- **Throughput**: logged FPS during pipeline run; check `[PERF]` log lines.
- **Event latency**: difference between frame timestamp and event `timestamp` field.

### Test scenarios
- Empty room (expected: 0 occupants)
- Seated occupants (YOLO may miss seated people — note in results)
- Crowded room (tracking ID churn — note stabilization behaviour)
- Simulated camera failure (pull video file mid-run; expect `health=failed`, no fresh events)

**Do not report accuracy numbers from unit tests.** Only report numbers from real-video runs.

---

## Known limitations

- YOLO detection accuracy for seated people is lower than for standing people.
- ByteTrack may churn IDs during heavy occlusion.
- Zone polygons must be manually calibrated per camera/room layout.
- Lighting state is manually supplied — no automatic detection.
- Webcam and RTSP support are stub extensions; not fully implemented.
- Confidence is a count-stability score, not a calibrated probability.
