# Obedience API evidence

## Correct target

The integration target is the Obedience habit-tracking service/app, not an Obins hardware device.

Official public material identifies Obedience as a mobile and web application for D/s habit tracking. The repository must use `obedience` terminology for the future service adapter; `obins` was based on an incorrect device assumption.

## Confirmed public evidence

As of 2026-08-21:

- Obedience has an official web application linked from its public website.
- Obedience release notes published through the App Store state that the v10.19.6-era update "expanded our API to make it easier for developers to create extensions for Obedience."
- The public Obedience website exposes a "For Developers" entry under "Work with Us".
- Public search did not reveal enough official API documentation to safely implement authentication, endpoints, request schemas, permissions, or mutation semantics.

## Implementation gate

Do not infer API details from the mobile/web client and do not ask users to provide their Obedience password to this bridge.

Before enabling `ADAPTER=obedience`, obtain official developer documentation or equivalent first-party evidence covering at minimum:

- supported authentication/authorization mechanism;
- developer/application registration, if required;
- API base URL and versioning;
- scopes/permissions;
- habit/task read and write operations required by the bridge;
- stable identifiers and pagination;
- rate limits;
- error and retry semantics;
- webhook/event support, if any;
- token revocation and secret-storage requirements;
- terms governing third-party extensions.

Until those facts are verified, the real Obedience adapter remains disabled and the fake adapter remains the only executable adapter.

## Sources

- https://obedienceapp.com/
- https://obedienceapp.com/contact
- Apple App Store release history for Obedience: BDSM Habit Tracker (release notes around v10.19.6 / v10.20.0)

These references establish that a developer-facing API exists or is intended to exist; they do **not** establish its protocol details.
