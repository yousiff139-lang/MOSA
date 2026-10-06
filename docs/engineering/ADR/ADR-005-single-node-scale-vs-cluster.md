# ADR-005: Single-Node Mosquitto Deployment vs Premature Clustering

* **Status:** `ACCEPTED & VALIDATED`
* **Date:** 2026-08-31
* **Deciders:** MOSA AL-KADHEM

---

## Context
During early scaling tests, a connection cliff occurred at ~2,000 devices. A multi-week migration to an EMQX distributed cluster was proposed. However, root-cause diagnostics revealed that the limit was caused entirely by Docker Desktop for Windows userland port forwarding (`docker-proxy` buffer resets on `localhost:1883`), not Mosquitto.

## Decision
1. Retain single-node containerized Mosquitto broker (`eclipse-mosquitto:latest`) with container `ulimit -n 1048576`.
2. Benchmark native container networking: Proven to sustain **10,000 concurrent active devices** with **1ms P50 latency**, consuming only **66.8 MiB RAM**.
3. Defer EMQX distributed clustering until deployment scale exceeds **50,000 devices** across multiple geographic data centers.

## Consequences
* **Positive:** Saves weeks of complex infrastructure re-architecting, eliminates cluster split-brain risks, and drastically reduces server hosting costs.
* **Negative:** Single point of failure for the MQTT broker on a single host (mitigated by automated Docker restart policies and database persistence).
