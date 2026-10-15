# Eprodux

**Eprodux** is a sustainability-focused digital twin of a university building. It combines computer vision occupancy monitoring with generative AI sustainability recommendations.

## Components

| Component | Owner | Status |
|-----------|-------|--------|
| Computer Vision (CV) | Member 1 | ✅ Implemented |
| Backend / Twin API | Member 2 | ⏳ Pending |
| Generative AI | Member 3 | ⏳ Pending |
| Frontend / Dashboard | Member 4 | ⏳ Pending |

## Shared Building Configuration

**Room IDs (canonical):**

| Room | Canonical ID |
|------|-------------|
| Seminar Hall | `seminar_hall` |
| Classroom | `classroom` |
| Lab | `lab` |
| Office | `office` |

These IDs are used in all inter-component contracts. Do not rename them without team consensus.

## CV Event Contract

Published by the CV component on meaningful state changes and periodically:

```json
{
  "zone_id": "seminar_hall",
  "timestamp": "2026-10-15T10:30:00Z",
  "occupancy": 3,
  "light_state": "on",
  "confidence": 0.85
}
```

See [`cv/README.md`](cv/README.md) for full field definitions.

## Getting Started

See each component's `README.md` for local setup instructions.

## Architecture

```
[Recorded Video] ──▶ [CV Service] ──▶ [Backend / Twin API] ──▶ [GenAI]
                                                │
                                         [Frontend / Dashboard]
```
