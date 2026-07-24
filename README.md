# HookVault Free

**Self-hostable webhook delivery & debugging gateway.** Sits between your app and
your customers' endpoints, delivering events reliably — signed, retried, and
logged — so a slow or dead customer endpoint never breaks your API.

> This is the open-core **Free** edition (MIT licensed). Premium and Pro tiers
> add reliability, ops, and governance modules — see *Upgrading* below.

## Why HookVault

Rolling your own webhook sender means reimplementing retries, signatures, and
delivery logs. Hosted gateways are expensive and lock you in. HookVault is the
middle path: a small, dependency-light gateway you run yourself.

## What's in the Free tier

- **Sources & endpoints** — register producers and their delivery URLs.
- **Signed delivery** — every webhook is HMAC-signed (`X-HookVault-Signature`,
  timestamped, replay-resistant).
- **Automatic retries** — fixed-interval retry up to a configurable limit, with
  a terminal dead-letter state.
- **Delivery log** — inspect every attempt (status, response code, timing) via
  API or the built-in dashboard.
- **Dashboard** — a zero-build HTML dashboard at `/`.

## Tech

- Node.js 20+ (built with 24). ESM.
- Express 5, zod. Persistence via the runtime's built-in `node:sqlite` — **no
  native build step, no external database.**
- 3 runtime dependencies. 0 known vulnerabilities.

## Quick start

```bash
npm install
cp .env.example .env          # then edit MASTER_SIGNING_SECRET
npm run migrate
npm start                     # dashboard on http://127.0.0.1:3000
```

See **SETUP.md** for configuration and **HOW-TO.md** for the end-to-end flow.

## Architecture (open-core)

The Free tier is a complete, standalone application. Paid features live in
isolated modules (`src/modules/`, not included in this build) that activate only
through a feature gate. Nothing paid ships here — and nothing free depends on
anything paid.

## Upgrading

| | Free | Premium | Pro |
|---|---|---|---|
| Signed delivery, retries, dead-letter, log | ✅ | ✅ | ✅ |
| Exponential backoff, DLQ view, one-click replay | | ✅ | ✅ |
| **Durable (restart-safe) retry queue** | | ✅ | ✅ |
| **AI-ready failure triage** | | ✅ | ✅ |
| Searchable logs, key rotation, alerting, role-scoped API keys | | ✅ | ✅ |
| Workspaces + RBAC, transforms + preview, SLA, health, audit, export | | | ✅ |

Premium **$49/mo**, Pro **$199/mo**. Contact sales@hookvault.example.

## License

MIT — see `LICENSE`.
