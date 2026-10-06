# ADR-003: ESP32 Cryptographic OTA Checksum & Signature Guard

* **Status:** `ACCEPTED & ENFORCED`
* **Date:** 2026-08-26
* **Deciders:** MOSA AL-KADHEM

---

## Context
Over-The-Air (OTA) firmware update endpoints on IoT devices are primary attack targets. Flashing unauthenticated binaries can permanently brick devices or inject persistent botnet payloads.

## Decision
1. Update `OTAUpdater.cpp` and `R1_Refactored.ino` to mandate `Update.setMD5(expectedChecksum)` before flashing.
2. Require Ed25519 / HMAC digital signature verification in the binary header before acknowledging the update command.
3. Reject unsigned or mismatched binaries immediately with `OTA_REJECTED_SIGNATURE_MISMATCH` and preserve existing flash partition.

## Consequences
* **Positive:** Prevents malicious or corrupted firmware flashing.
* **Negative:** Requires build pipeline to compute and attach MD5 / signatures during release artifact generation.
