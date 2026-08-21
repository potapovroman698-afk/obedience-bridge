# Obins integration contract

## Status

This document defines the boundary that must be satisfied before any real Obins integration is implemented. It deliberately does **not** invent endpoints, authentication schemes, payloads, device commands, transports, or protocol details.

## Goal

Keep the bridge implementation testable and safe while allowing a future verified Obins adapter to be added without coupling vendor-specific behavior to the HTTP service.

## Required evidence before implementation

A real adapter may only be implemented after we have a trustworthy source for each applicable item:

1. Supported product/model identifiers and firmware constraints.
2. Official or otherwise verified transport/protocol documentation.
3. Authentication or pairing procedure, if any.
4. Request/command format and response/event format.
5. Error semantics, timeouts, retries, and rate limits.
6. Device discovery and identity rules.
7. State read/write semantics and idempotency guarantees.
8. Safety constraints and unsupported operations.
9. Licensing or redistribution constraints for any SDK/protocol material.

Unknown items remain `UNKNOWN`; they must not be filled by inference.

## Internal adapter boundary

The application should depend on a vendor-neutral adapter with capabilities equivalent to:

- `connect()` — establish a verified device/session connection.
- `disconnect()` — close resources cleanly and idempotently.
- `getStatus()` — return normalized bridge/device status without exposing credentials.
- `execute(command)` — accept only commands represented by a validated internal command type.

These names describe the **internal application boundary only**. They are not claims about the Obins API.

## Normalized errors

Vendor-specific failures should be translated into a small internal set such as:

- `NOT_CONFIGURED`
- `NOT_CONNECTED`
- `UNSUPPORTED`
- `INVALID_COMMAND`
- `TIMEOUT`
- `DEVICE_ERROR`

Raw credentials, tokens, request bodies, device secrets, and vendor payloads must not be placed in logs or client-facing error messages.

## Safety rules

- Default to no device access when configuration is absent or invalid.
- Never silently retry state-changing commands unless verified protocol semantics make the retry safe.
- Apply explicit timeouts to external I/O.
- Validate all external data before it reaches application logic.
- Keep health checks independent of device availability unless a separate readiness endpoint is intentionally introduced.
- Do not expose arbitrary pass-through vendor commands from HTTP.
- Do not commit credentials, pairing secrets, tokens, captured private traffic, or personal device identifiers.

## Testing strategy

Before real hardware is involved, implement a fake adapter against the internal boundary and test:

1. successful connection and disconnection;
2. unavailable/not-configured behavior;
3. invalid and unsupported commands;
4. timeout/error normalization;
5. shutdown while an adapter is connected;
6. assurance that sensitive fields are not logged.

Real adapter tests should be added only when verified protocol details are available, and hardware-dependent tests should remain separate from ordinary CI unless a safe dedicated test environment exists.

## Definition of ready for real Obins work

Implementation can begin when the required evidence is captured in this repository with source references and the unresolved items needed for the first supported operation are reduced to zero.
