# MOSA Smart Home — End-to-End Real Data Flow Architecture

This document specifies the complete, zero-mock real data flow architecture of the MOSA Smart Home platform across the entire stack: Frontend, Backend API, PostgreSQL (Prisma), MQTT Broker, ESP32 Firmware, and WebSockets (Socket.io).

---

## 1. End-to-End Control Pipeline

```
[User Action in UI]
       │
       ▼
[Frontend API Call] ──► POST /api/devices/:id/toggle
       │
       ▼
[Backend Authorization & RBAC Check] (Session Token + HomeMember Role)
       │
       ▼
[MQTT Publication] ──► Topic: mosa/{homeId}/device/{boardId}/command
       │
       ▼
[ESP32 Hardware Execution] (Relay / PWM GPIO Pin Action)
       │
       ▼
[ESP32 State Publication] ──► Topic: mosa/{homeId}/device/{boardId}/state
       │
       ▼
[Backend State Processor] ──► Update Device state in PostgreSQL DB
       │
       ▼
[Socket.io Broadcast] ──► Event: device:state / telemetry_update
       │
       ▼
[Frontend State Update] (UI updates icon glow & status in real-time)
```

---

## 2. Floor Plan & Home Designer API Specifications

| Method | Endpoint | Description | PostgreSQL Model |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/floorplan` | Fetch persisted floor plan layout, rooms, dimensions, and placed devices | `FloorPlan`, `FloorPlanDevice` |
| `POST` | `/api/floorplan` | Save or update layout geometry, rooms, width, and length | `FloorPlan` |
| `POST` | `/api/floorplan/devices` | Place or update device `(x, y)` coordinate position on floor plan map | `FloorPlanDevice` |
| `PATCH` | `/api/floorplan/devices/:id` | Move existing device position | `FloorPlanDevice` |
| `DELETE` | `/api/floorplan/devices/:id` | Remove device placement from map | `FloorPlanDevice` |

---

## 3. Real Database Source of Truth

- **Tenant Isolation:** Every query enforces `homeId` scoping to ensure multi-home security.
- **Empty State Policy:** When no devices or rooms exist in PostgreSQL for a tenant, the UI renders an explicit user notice rather than displaying hardcoded or simulated mock devices.
- **Persistence Verification:** Refreshing the browser or opening another session fetches the exact floorplan layout and device positions persisted in PostgreSQL.
