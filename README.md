# obedience-bridge

A small bridge service for the official Obedience extension API.

## Status

The repository implements authorization, read-only API access, and a verified inbound webhook receiver for the documented Obedience extension API. It does **not** accept an Obedience email/password and it does **not** enable habit mutations yet.

Current security posture is deliberately fail-closed: authorization and webhook handling remain disabled unless their complete runtime configuration is supplied, callback credentials are persisted outside the repository, callback query secrets are excluded from application access logs, and webhook payloads must pass RSA-SHA256 signature verification before they are accepted.

## Architecture

```text
browser
  |
  | GET /obedience/authorize
  v
obedience-bridge ------------------> official Obedience permission screen
  ^                                         |
  | HTTPS /obedience/callback               | user grants extension access
  +-----------------------------------------+
  |
  +--> protected credential store (id / secret / uid)
  |
  +--> isolated Obedience API client (read-only foundation)

Obedience
  |
  | POST /obedience/webhook + X-Signature
  v
obedience-bridge --> verify RSA-SHA256 signature --> validate extension credentials --> accept event
```

## HTTP surface

- `GET /health` — process health.
- `GET /ready` — adapter readiness.
- `GET /obedience/authorize` — redirects to the official Obedience extension permission flow when configured.
- `GET /obedience/callback` — validates and stores credentials returned by the official flow.
- `POST /obedience/webhook` — accepts only correctly signed Obedience webhook payloads when webhook runtime configuration is present.

The callback response never returns the extension secret. The webhook receiver does not expose the webhook secret in its accepted event object.

## Runtime configuration

Normal service settings:

```text
HOST=127.0.0.1
PORT=3000
ADAPTER=fake
```

Obedience authorization remains disabled unless these three settings are provided together:

```text
OBEDIENCE_EXTENSION_ID=<stable UUID generated for this bridge>
OBEDIENCE_REDIRECT_URL=https://<public-host>/obedience/callback
OBEDIENCE_CREDENTIAL_PATH=/persistent-private-data/obedience-credentials.json
```

Optional:

```text
OBEDIENCE_EXTENSION_NAME=Obedience Bridge
```

`OBEDIENCE_REDIRECT_URL` must use HTTPS and its path must be exactly `/obedience/callback`.

Webhook handling remains disabled unless all three webhook settings are provided together:

```text
OBEDIENCE_WEBHOOK_PUBLIC_KEY=<official Obedience webhook RSA public key in PEM form>
OBEDIENCE_WEBHOOK_EXTENSION_ID=<extension id expected in webhook payloads>
OBEDIENCE_WEBHOOK_SECRET=<extension secret expected in webhook payloads>
```

The public key is not secret, but it must come from the official Obedience webhook documentation/source and must not be silently replaced with an arbitrary key. `OBEDIENCE_WEBHOOK_EXTENSION_ID` and `OBEDIENCE_WEBHOOK_SECRET` are deployment secrets and must be supplied through the hosting platform's secret-management mechanism, not committed to the repository.

The authorization credential file and webhook secret serve different purposes. The authorization flow writes its issued credentials to `OBEDIENCE_CREDENTIAL_PATH`; webhook verification currently receives its expected extension id and secret through runtime configuration. Do not copy either value into source code, images, issues, pull requests, logs, or CI output.

## Public HTTPS requirements

A live Obedience integration needs a stable HTTPS deployment. The public routes expected by this service are:

```text
https://<public-host>/obedience/callback
https://<public-host>/obedience/webhook
```

The reverse proxy or hosting platform must forward the webhook request body without rewriting it before the application verifies `X-Signature`. Signature verification is performed over the exact raw request bytes, so middleware or proxies that transform JSON bodies can invalidate legitimate signatures.

Keep infrastructure request logging minimal. In particular, do not log callback query strings or raw webhook bodies: both may contain secret-bearing values.

## Run locally

```bash
cp .env.example .env
npm test
npm start
```

Local execution is useful for tests and development, but live authorization and webhook delivery require a stable public HTTPS endpoint reachable by Obedience.

## Production checklist

Before enabling the live integration:

1. Deploy the service behind HTTPS on a stable hostname.
2. Use persistent private storage for `OBEDIENCE_CREDENTIAL_PATH`; do not use an ephemeral filesystem.
3. Generate one stable random UUID for `OBEDIENCE_EXTENSION_ID` and keep using the same ID for this deployment.
4. Set `OBEDIENCE_REDIRECT_URL` to the exact public HTTPS callback URL.
5. Configure `OBEDIENCE_WEBHOOK_PUBLIC_KEY`, `OBEDIENCE_WEBHOOK_EXTENSION_ID`, and `OBEDIENCE_WEBHOOK_SECRET` together through the platform secret/configuration layer.
6. Configure Obedience to deliver webhooks to the exact public HTTPS `/obedience/webhook` URL.
7. Ensure the reverse proxy preserves the raw webhook body and forwards the `X-Signature` header unchanged.
8. Keep reverse-proxy/platform logging from recording callback query strings or raw webhook bodies.
9. Verify `/health` and `/ready` before starting authorization or webhook delivery.
10. Back up or otherwise protect the credential store according to the hosting platform's secret-data model.
11. Send one controlled live Obedience event and confirm the service returns `202 {"status":"accepted"}` only for a valid signed delivery.

## Security boundaries

- Never commit `.env`, callback credentials, webhook secrets, or the credential-store file.
- Never ask the user for their Obedience password; authentication happens on Obedience's own permission screen.
- Treat callback query parameters and raw webhook bodies as secret-bearing data.
- Do not expose the credential store through static files, artifacts, logs, or repository content.
- Reject unsigned, incorrectly signed, oversized, credential-mismatched, and unsupported webhook payloads.
- Keep mutation support disabled until it has a separately reviewed authorization and policy boundary.
- The Obedience API is an external dependency; keep its client and webhook verification isolated so upstream changes do not silently weaken these boundaries.
