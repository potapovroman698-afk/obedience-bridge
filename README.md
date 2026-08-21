# obedience-bridge

A minimal, safe scaffold for a future bridge service.

## Status

This repository intentionally does **not** implement the Obins integration yet. No Obins endpoints, authentication flows, request/response schemas, device commands, or token formats are assumed or invented. That boundary stays unimplemented until official, verified API documentation is available.

## Architecture

```text
client / future caller
        |
        v
obedience-bridge HTTP server
        |
        v
adapter boundary
        |
        v
Obins integration (not implemented)
```

## Current surface

- `GET /health` -> basic process health response.
- Environment-based configuration through `src/config.js`.
- `src/adapters/obins.adapter.js` is a deliberately non-functional integration boundary.

## Run locally

```bash
cp .env.example .env
npm start
```

Default port: `3000`.

## Security notes

- Do not commit `.env` or real credentials.
- `.env.example` contains examples only and no secrets.
- Do not add guessed Obins URLs, methods, headers, tokens, or payloads.
- Keep real integration logic isolated behind the adapter once official API details are known.
