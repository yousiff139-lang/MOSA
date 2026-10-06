# ADR-001: Use Core Package and Result Pattern for Platform Scalability

## Status
Accepted

## Context
As MOSA evolves from a basic Smart Home controller to an Enterprise IoT Operating System (Smart Entertainment Platform), the number of device drivers (LG, Samsung, Android, Generic IR, etc.) and subsystems (Automations, Energy, Diagnostics) is expanding rapidly.

If each driver implements its own error handling, connection logic, and events, the system will become heavily fragmented. We also need a strong typing system across all microservices (Fastify API, React Frontend, Firmware Builders).

## Decision
1. **Core Monorepo Package**: We have created `packages/core` to act as the single source of truth for all Contracts (Interfaces), Types, Schemas, and Constants.
2. **Result Pattern**: Instead of throwing exceptions across driver boundaries, we enforce the use of a `Result<T, BaseError>` monad. This forces developers to explicitly handle error scenarios (e.g., Timeout, Authentication, Offline) before continuing execution.
3. **Event Bus architecture**: To synchronize state updates universally without tight coupling, drivers must emit strongly typed `DomainEvents` (e.g., `PowerChangedEvent`) over a central `EventBus`.

## Consequences
### Positive
- Strict driver contracts prevent bad implementations.
- Shared types ensure that the frontend UI and backend API speak the exact same language regarding Capabilities and State.
- Unhandled exceptions are vastly reduced because `Result.fail()` forces explicit error checking.

### Negative
- Slight overhead when writing new drivers: Developers must conform to the `BaseDriver` contract and wrap all returns in `Result.ok()` or `Result.fail()`.
- Initial boilerplate required to setup `@mosa/core`.
