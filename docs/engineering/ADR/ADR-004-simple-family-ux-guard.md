# ADR-004: Simple Mode Family-First UX & Automatic Route Gating

* **Status:** `ACCEPTED & ENFORCED`
* **Date:** 2026-08-26
* **Deciders:** MOSA AL-KADHEM

---

## Context
Non-technical household members (parents, elders, children) were overwhelmed when presented with engineering interfaces (network topology, MQTT broker metrics, firmware flasher, flow editors). Furthermore, encountering HTTP 403 Forbidden errors when clicking restricted links caused panic and confusion.

## Decision
1. Implement a 2-tier UI architecture: **Simple Mode (Default for Family)** vs **Full Mode (Engineers & Admins)**.
2. Build `SimpleModeGuard.tsx` in Next.js layout to intercept attempts to access technical routes (`/developer`, `/builder`, `/infrastructure/*`, `/logs`, `/ota`) in Simple Mode.
3. Automatically redirect to `/` (Simple Family Dashboard) with a warm Arabic toast notification (`هذه الصفحة مخصصة للفنيين`) instead of showing raw 403 pages.
4. Replace technical error codes (`503`, `timeout`) with friendly, reassuring Arabic messages via `friendlyErrors.ts`.

## Consequences
* **Positive:** Zero learning curve for non-technical users; complete safety from accidental configuration changes.
* **Negative:** Technical users must toggle to Full Mode in settings to access developer tools.
