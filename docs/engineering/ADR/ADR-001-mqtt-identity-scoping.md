# ADR-001: MQTT Zero-Trust Identity-Bound ACL Scoping

* **Status:** `ACCEPTED & ENFORCED`
* **Date:** 2026-08-26
* **Deciders:** MOSA AL-KADHEM

---

## Context
Previously, MQTT access control in `acl.conf` utilized single-level topic wildcards (`+`) under a shared account (`mosa_device`):
```text
user mosa_device
topic readwrite mosa/+/device/+/state
```
This allowed any physical or compromised device sharing `mosa_device` credentials to eavesdrop on and publish commands to all other homes' devices.

## Decision
1. Eliminate all shared wildcard topics for device tiers.
2. Bind permissions dynamically to the authenticated client username via Mosquitto's `%u` token expansion:
   ```text
   pattern readwrite mosa/%u/device/#
   pattern readwrite mosa/%u/controller/#
   pattern readwrite mosa/%u/sensor/#
   pattern readwrite mosa/%u/ota/#
   ```
3. Avoid binding to `%c` (Client ID) because ESP32 hardware randomly assigns suffixes upon connection (`MosaNode_MAC_MILLIS`), which previously triggered connection dropouts.
4. Quarantine legacy physical devices to a dedicated migration partition until re-flashed.

## Consequences
* **Positive:** Complete cryptographic tenant isolation at the broker layer. Cross-home publishes return `rc135 (Not Authorized)`.
* **Negative:** Requires per-home/per-device credential provisioning at onboarding time.
