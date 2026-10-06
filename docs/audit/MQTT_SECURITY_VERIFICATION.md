# 📡 MOSA SMART PLATFORM — MQTT SECURITY VERIFICATION
**Project Owner & Creator:** **MOSA AL-KADHEM**  
**Audit Stage:** Phase 6 — MQTT Broker & ACL Verification  
**Date:** August 24, 2026  

---

## 1. Broker Configuration & Listener Matrix

| Listener Port | Protocol | Encryption / TLS | Authentication | ACL Binding | Purpose |
|---|---|---|---|---|---|
| **1883** | MQTT TCP | None (LAN Only) | Allowed on local subnet | `acl_file /mosquitto/config/acl.conf` | Legacy & local ESP32 nodes |
| **8883** | MQTTS | TLSv1.2 / TLSv1.3 (mTLS) | Client Certificate Required | `acl_file /mosquitto/config/acl.conf` | Secure production nodes & cloud bridge |
| **9001** | WSS | TLSv1.2 (WebSockets) | Certificate / Token Required | `acl_file /mosquitto/config/acl.conf` | Browser Web App & PWA clients |

---

## 2. Topic Isolation & ACL Patterns

```
# Master Backend Access
user mosa-backend
topic readwrite mosa/#
topic readwrite homeassistant/#

# Client-Scoped Dynamic Patterns (%c = Client ID, %u = Username)
pattern readwrite mosa/+/device/%c/#
pattern readwrite mosa/+/controller/%c/#
pattern readwrite mosa/+/device/%u/#
pattern readwrite mosa/discovery
pattern read mosa/scan
```

### Verification Result:
- Generic device accounts (`MOSA-ESP-001`, `mosa_device`) no longer have global wildcard `mosa/#` access.
- Cross-tenant topic injection and sniffing are rejected at the Mosquitto broker engine.
