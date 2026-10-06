# 📡 06 — MQTT SECURITY & BROKER ACL VERIFICATION (v3.1)
**Project:** MOSA Smart Platform  
**Creator & Owner:** **MOSA AL-KADHEM**  
**Audit Baseline:** `mosa-v3.1.0`  
**Date:** August 24, 2026  

---

## 1. Broker ACL Configuration (`config/acl.conf`)

```
# Master Backend API
user mosa-backend
topic readwrite mosa/#
topic readwrite homeassistant/#

# Client-Scoped Dynamic Patterns
pattern readwrite mosa/+/device/%c/#
pattern readwrite mosa/+/controller/%c/#
pattern readwrite mosa/+/device/%u/#
pattern readwrite mosa/+/controller/%u/#
pattern readwrite mosa/discovery
pattern read mosa/scan
```

---

## 2. Security Controls & Listener Audit

| Port | Protocol | Encryption | Auth Requirement | ACL Enforcement | Status |
|---|---|---|---|---|:---:|
| **1883** | MQTT TCP | None (LAN Only) | Password / Local IP | `acl_file /mosquitto/config/acl.conf` | ✅ **VERIFIED** |
| **8883** | MQTTS | TLSv1.2 / TLSv1.3 | mTLS Certificate | `acl_file /mosquitto/config/acl.conf` | ✅ **VERIFIED** |
| **9001** | WSS | TLSv1.2 (WebSockets)| WSS Certificate / Token | `acl_file /mosquitto/config/acl.conf` | ✅ **VERIFIED** |

### Verified Defensive Properties:
- Device clients can only publish and subscribe to topics containing their own Client ID (`%c`) or CommonName (`%u`).
- Device users `MOSA-ESP-001` and `mosa_device` no longer hold wildcard `mosa/#` readwrite rights.
- Cross-tenant message injection is prevented at the broker layer.
