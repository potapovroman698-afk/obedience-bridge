# obedience-bridge

A small bridge service for the official Obedience extension API.

## Status

The repository now implements the authorization and read-only foundations for the documented Obedience extension API. It does **not** accept an Obedience email/password and it does **not** enable habit mutations yet.

Current security posture is deliberately fail-closed: Obedience authorization is disabled unless all required runtime values are supplied, callback credentials are persisted outside the repository, and callback query secrets are excluded from application access logs.

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
```

## HTTP surface

- `GET /health` — process health.
- `GET /ready` — adapter readiness.
- `GET /obedience/authorize` — redirects to the official Obedience extension permission flow when configured.
- `GET /obedience/callback` — validates and stores credentials returned by the official flow.

The callback response never returns the extension secret.

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

Do **not** put the Obedience extension `secret` in environment variables or GitHub secrets. It is issued by Obedience after authorization and is written by the service to `OBEDIENCE_CREDENTIAL_PATH` with restrictive filesystem permissions.

## Run locally

```bash
cp .env.example .env
npm test
npm start
```

Local execution is useful for tests and development, but a live Obedience authorization requires a stable public HTTPS callback URL.

## Production checklist

Before starting a real authorization flow:

1. Deploy the service behind HTTPS on a stable hostname.
2. Use persistent private storage for `OBEDIENCE_CREDENTIAL_PATH`; do not use an ephemeral filesystem.
3. Generate one stable random UUID for `OBEDIENCE_EXTENSION_ID` and keep using the same ID for this deployment.
4. Set `OBEDIENCE_REDIRECT_URL` to the exact public HTTPS callback URL.
5. Keep reverse-proxy/platform request logging from recording callback query strings. The application itself logs pathname only, but infrastructure logs are a separate boundary.
6. Verify `/health` and `/ready` before visiting `/obedience/authorize`.
7. Back up or otherwise protect the credential store according to the hosting platform's secret-data model.

## Security boundaries

- Never commit `.env`, callback credentials, or the credential-store file.
- Never ask the user for their Obedience password; authentication happens on Obedience's own permission screen.
- Treat callback query parameters as secret-bearing data.
- Do not expose the credential store through static files, artifacts, logs, or repository content.
- Keep mutation support disabled until it has a separately reviewed authorization and policy boundary.
- The Obedience API is an external dependency; keep its client isolated so API changes do not silently weaken these boundaries.
