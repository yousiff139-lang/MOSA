# ADR-0008: Decoupled Control-Plane (MQTT) and Data-Plane (HTTP/I2S) Architecture for Smart Speaker Hubs

## Status
Accepted

## Context
In the MOSA Smart Home ecosystem, smart speakers (ESP32-S3 + PCM5102A Hi-Fi DAC) serve dual critical roles:
1. **Interactive Audio Hub**: Playing internet radio, podcast streams, home notifications, alarms, and AI Voice Assistant (TTS) responses.
2. **Whole-Home Control Endpoint**: Responding to remote commands from web dashboards, mobile apps, room scenes, and cloud automations.

### The Architectural Problem
A naive implementation relied entirely on local HTTP REST endpoints hosted on the ESP32 (`POST http://<speaker-ip>/api/audio/play`). This approach suffered from four severe architectural flaws:
1. **Lack of Tenant Isolation**: Direct HTTP calls bypassed Mosquitto dynamic security and backend RBAC tenant boundaries (`homeId`), making it possible for cross-tenant or unauthenticated LAN entities to control playback.
2. **NAT & Multi-Subnet Inaccessibility**: In cloud-hosted deployments or complex home networks with separate IoT VLANs, the backend cannot establish inbound TCP connections to the speaker's private LAN IP.
3. **Audio Glitching (Buffer Starvation)**: Servicing inbound HTTP REST handshakes (TCP 3-way handshake, TLS/HTTP parsing, JSON deserialization) on the ESP32 CPU core while concurrently decoding 44.1kHz 32-bit I2S audio caused micro-underruns in the DMA buffer, resulting in audible stutter, popping, and clicking.
4. **Security Vulnerabilities**: Local unauthenticated REST endpoints exposed to LAN allowed arbitrary devices or CSRF web scripts to trigger high-volume noise or spoof voice announcements.

---

## Decision
We enforce a strict **Decoupled Architecture**:
- **Control Plane -> MQTT Broker (mTLS/QoS 1)**
- **Data Plane -> HTTP/HTTPS Streaming (Outbound Client only)**
- **Edge Fallback Plane -> Authenticated Local REST (Guarded with `X-API-Key`)**

```
 ┌────────────────────────────────────────────────────────┐
 │                      CONTROL PLANE                     │
 │   [Web UI / Mobile] ──> [Fastify API]                  │
 │                              │                         │
 │                   (MQTT QoS 1 / Tenant ACL)            │
 │                              ▼                         │
 │   [Mosquitto Broker] ──> mosa/{homeId}/audio/{node}/set │
 │                              │                         │
 │                              ▼                         │
 │                   [ESP32-S3 MQTT Client]               │
 │                              │                         │
 └──────────────────────────────┼─────────────────────────┘
                                │ Triggers URL Stream
 ┌──────────────────────────────▼─────────────────────────┐
 │                       DATA PLANE                       │
 │                   [ESP32-S3 Audio Client]              │
 │                              │                         │
 │                   (Outbound HTTP/HTTPS GET)            │
 │                              ▼                         │
 │        [Remote CDN / Icecast Radio / Backend TTS]      │
 │                              │ (MP3 / AAC / WAV)       │
 │                              ▼                         │
 │                    [I2S DMA Buffer]                    │
 │                              │                         │
 │                              ▼                         │
 │               [PCM5102A Hi-Fi DAC Hardware]            │
 └────────────────────────────────────────────────────────┘
```

### 1. Control Plane Specification (MQTT)
All control commands and telemetry updates flow asynchronously over the Mosquitto broker:
- **Command Topic (Backend/User -> Speaker)**:
  `mosa/{homeId}/audio/{nodeId}/set`
  Payload schema:
  ```json
  {
    "action": "play" | "stop" | "toggle" | "volume" | "volume-up" | "volume-down" | "mute" | "tts",
    "url": "https://...",
    "level": 14,
    "text": "مرحباً، تم تشغيل إضاءة الصالون",
    "messageId": "audio_1725619200_a1b2",
    "timestamp": 1725619200000
  }
  ```
- **State Telemetry Topic (Speaker -> Backend/UI)**:
  `mosa/{homeId}/audio/{nodeId}/state`
  Payload schema:
  ```json
  {
    "nodeId": "MosaNode_3030F96A1F5C",
    "isPlaying": true,
    "isMuted": false,
    "volume": 14,
    "volumePct": 50,
    "track": "إذاعة القرآن الكريم",
    "source": "Internet Radio",
    "rssi": -58
  }
  ```
- **LWT / Presence Topic**:
  `mosa/{homeId}/audio/{nodeId}/status` (`online` | `offline`)

### 2. Data Plane Specification (HTTP/HTTPS Streaming)
- The ESP32 operates exclusively as an **Outbound HTTP Client** using `Audio.connecttohost(url)`.
- It connects to external audio streams (MP3/AAC streams, Google TTS audio URLs, or internal media server files).
- The network stack streams audio packets directly into DMA ring buffers with zero interaction with the local web server.

### 3. Edge Fallback Plane (Local REST)
- Local HTTP endpoints (`/api/audio/*` on `mosa-speaker.local`) are retained strictly for offline emergency access when the MQTT broker is unreachable.
- All endpoints require an `X-API-Key` header matching `SPEAKER_API_KEY`. Requests lacking this key receive `401 Unauthorized`.
- Wildcard CORS is prohibited; allowed origins are strictly scoped.

---

## Consequences

### Positive
1. **Complete Multi-Tenant Isolation**: Enforced by Mosquitto dynamic security rules matching `mosa/{homeId}/#`. No cross-tenant audio packet leakage.
2. **Seamless NAT Traversal**: Control commands reach speakers deployed behind any standard home router or LTE gateway without requiring port forwarding.
3. **Zero Audio Stutter**: CPU-intensive inbound HTTP connection negotiation is eliminated during playback. The I2S DMA pipeline runs uninterrupted.
4. **Low Latency (<50ms)**: MQTT QoS 1 publish delivers immediate response across web dashboard, mobile app, and physical remotes.
5. **Real-time Multi-Client Sync**: Telemetry broadcast updates all connected dashboards (Socket.IO + MQTT) simultaneously.

### Negative
- ESP32-S3 firmware must maintain an active MQTT client (`PubSubClient`) connection in addition to the Audio engine.
- Loop iterations must remain strictly non-blocking (`audio.loop()` and `mqttClient.loop()` without delays) to guarantee continuous audio feeding.
