# Obins evidence checklist

## Purpose

This checklist is the gate for enabling an `obins` adapter in configuration. A checkbox may be marked complete only when the repository contains a trustworthy source reference and enough detail to implement and test the corresponding behavior without inference.

Until every item required for the first supported operation is satisfied, `ADAPTER=obins` must remain rejected.

## Evidence record format

For every verified fact, record:

- **Claim:** the precise behavior we rely on.
- **Source:** official documentation, vendor SDK source, verified protocol material, or another explicitly reviewed source.
- **Source version/date:** enough information to detect stale evidence.
- **Applies to:** exact device model(s), hardware revision(s), firmware version/range, and host platform when relevant.
- **Confidence:** `VERIFIED` or `UNKNOWN`. Do not use guessed/intermediate confidence labels.
- **Notes:** limitations, observed differences, unresolved questions.

Do not commit credentials, pairing secrets, private captures, personal device identifiers, or material we do not have permission to redistribute.

## Gate A — target device

- [ ] Exact Obins product/model identifier is known.
- [ ] Hardware revision, if relevant, is known.
- [ ] Firmware version/range is known.
- [ ] Supported host OS/runtime constraints are known.
- [ ] We know whether behavior differs by model or firmware.

## Gate B — transport and discovery

- [ ] Transport is verified (for example USB/BLE/etc.; do not assume which).
- [ ] Device discovery/selection rules are verified.
- [ ] Stable device identity rules are verified.
- [ ] Connection establishment and teardown are documented.
- [ ] Reconnection behavior is documented.
- [ ] Required permissions/drivers/system services are documented.

## Gate C — authentication / pairing

- [ ] Whether authentication or pairing is required is verified.
- [ ] Pairing/authentication sequence is documented if applicable.
- [ ] Secret/token lifetime and storage requirements are documented if applicable.
- [ ] Revocation/reset/re-pair behavior is documented if applicable.
- [ ] Logging/redaction requirements for sensitive values are identified.

## Gate D — protocol framing

- [ ] Request/command framing is documented.
- [ ] Response/event framing is documented.
- [ ] Encoding, byte order, checksums, sequence IDs, or equivalent fields are documented where applicable.
- [ ] Maximum/minimum payload sizes are known where applicable.
- [ ] Correlation between requests and responses is understood.
- [ ] Unsolicited events/notifications are understood if they exist.

## Gate E — first supported operation

Define one minimal operation before implementing anything real.

- [ ] Internal command name and schema are defined.
- [ ] Verified vendor/device command mapping exists.
- [ ] Preconditions are known.
- [ ] Success response/state transition is known.
- [ ] Invalid/unsupported behavior is known.
- [ ] Idempotency is known.
- [ ] Safe retry behavior is known.
- [ ] Timeout bounds are justified by evidence.
- [ ] A read-back or other verification method is known when state changes.

## Gate F — errors and resilience

- [ ] Device/protocol error codes relevant to the first operation are documented.
- [ ] Disconnect behavior during an operation is understood.
- [ ] Timeout behavior is understood.
- [ ] Rate limits/backoff requirements are known if applicable.
- [ ] Retryable vs non-retryable failures are distinguishable.
- [ ] Vendor failures can be mapped to the bridge's normalized error set without losing safety-critical meaning.

## Gate G — safety and privacy

- [ ] Unsupported operations are explicitly identified.
- [ ] No arbitrary raw command pass-through is required.
- [ ] Sensitive fields are identified and redacted from logs/errors.
- [ ] Device identifiers exposed by the protocol are classified and minimized.
- [ ] State-changing behavior has explicit bounds and validation.
- [ ] Shutdown/disconnect behavior cannot leave a known unsafe intermediate state.

## Gate H — licensing and provenance

- [ ] Source material provenance is recorded.
- [ ] SDK/library license is compatible with this repository if code will be used.
- [ ] Reverse-engineered material, if any, has been reviewed for legal/redistribution constraints before being committed.
- [ ] No proprietary binary/blob is added without clear redistribution permission.

## Gate I — tests before enablement

- [ ] Protocol codec/framing has deterministic unit tests if applicable.
- [ ] Recorded fixtures contain no secrets or personal identifiers.
- [ ] Error normalization tests exist.
- [ ] Timeout/cancellation tests exist.
- [ ] Connect/disconnect lifecycle tests exist.
- [ ] First operation has success, invalid-input, unsupported, timeout, and device-error tests as applicable.
- [ ] Hardware-dependent tests are isolated from ordinary CI unless a dedicated safe test environment exists.
- [ ] `ADAPTER=obins` remains disabled until the implementation and required tests pass review.

## Evidence table

| ID | Claim | Source | Version/date | Applies to | Confidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| E-001 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Start here; replace only with verified evidence. |

## Enablement decision

`ADAPTER=obins` may be added to the accepted configuration only in the same PR (or after the PR) that provides:

1. the verified evidence required for the first supported operation;
2. the real adapter implementation behind the existing vendor-neutral boundary;
3. required tests;
4. explicit review that no unknown protocol detail has been filled by inference.

If any required fact remains `UNKNOWN`, the decision is **do not enable**.
