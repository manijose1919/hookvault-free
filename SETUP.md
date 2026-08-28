# HookVault Free — Setup

## Requirements

- **Node.js 20 or newer** (built and tested on 24). Check with `node --version`.
- No database server, no compiler, no native modules.

## Install

```bash
npm install
```

## Configure

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `HOST` | `127.0.0.1` | Bind address (keep on localhost unless fronted by a proxy) |
| `DATABASE_PATH` | `./data/hookvault.sqlite` | SQLite file location |
| `HOOKVAULT_TIER` | `free` | Licensed tier (this build supports `free`) |
| `MASTER_SIGNING_SECRET` | — | **Set this.** Derives per-endpoint signing secrets |
| `DELIVERY_TIMEOUT_MS` | `10000` | Per-delivery HTTP timeout |
| `MAX_DELIVERY_ATTEMPTS` | `3` | Attempts before an event is dead-lettered |
| `NODE_ENV` | `development` | In `production`, a non-default `MASTER_SIGNING_SECRET` is required |
| `HOOKVAULT_ALLOW_REMOTE` | unset | Required to bind `HOST` to anything other than loopback |

Generate a strong secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Initialize the database

```bash
npm run migrate
```

## Run

```bash
npm start            # production-style
npm run dev          # auto-restart on change
```

The dashboard is served at `http://HOST:PORT/`.

> **Note:** SQLite support uses Node's `--experimental-sqlite` flag, already wired
> into the npm scripts. You'll see one experimental-feature warning on boot; it
> is expected.

## Run the tests

```bash
npm test
```

## Production notes

- Bind to `127.0.0.1` and place HookVault behind a TLS-terminating reverse proxy.
  Binding to `0.0.0.0` is refused unless `HOOKVAULT_ALLOW_REMOTE=1`.
- Delivery targets must be public http(s) URLs — loopback, RFC1918, and
  link-local/metadata addresses are rejected so HookVault cannot be used as
  an SSRF trampoline.
- The management API (`/sources`, `/deliveries`, dashboard) is unauthenticated in
  the Free tier and relies on localhost binding. Network-facing API-key auth is a
  Premium feature.
- Retries are in-process; a restart mid-retry does not resume in-flight retries
  (a durable queue is on the roadmap / Premium).
