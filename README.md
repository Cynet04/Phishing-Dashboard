# Phishing Dashboard (Educational Simulation)

A lightweight phishing-simulation dashboard for security awareness training. It provides campaign management, target tracking, simulated send/click/submit events, and a metrics dashboard.

> **Educational use only.** The mock landing page records simulation events and does not store real credentials.

## Stack
- Node.js 18+ (built-in `http`, `fs`, `crypto`, `node:test`)
- Zero external dependencies
- JSON-file data layer in `data/db.json` (easy to swap for a real database)

## Run
```bash
npm install   # no dependencies, but safe to run
npm start     # http://localhost:3000
```

Development (Node 18+ watch):
```bash
npm run dev
```

## Test
```bash
node --test --test-concurrency=1
# or: npm test
```

> Note (Windows PowerShell): `npm.ps1` may be blocked by execution policy in some environments. Use `node --test` or `npm.cmd test`.

## Optional admin auth
Set `ADMIN_PASSWORD` to protect the dashboard and management APIs with a simple signed session cookie. The dashboard shows auth status and a logout action when enabled.

```bash
# PowerShell
$env:ADMIN_PASSWORD='change-me'; npm start
# bash
ADMIN_PASSWORD=change-me npm start
```
Public endpoints remain available for the educational simulation flow: `/api/health`, `/login-simulation*`, `/education`.

## API
- `GET /api/health` (alias: `/api/healthz`; includes `uptimeSeconds`, `node`, and safe `dataFile` basename)
- `GET /api/readyz` (auth-exempt readiness check; verifies data store can be loaded)
- `GET /api/version` (safe service/version/node/time, no secrets)
- `GET /api/templates`, `POST /api/templates`, `PUT /api/templates/:id`, `DELETE /api/templates/:id`
- `GET /api/stats?campaignId=&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/campaigns?q=&limit=&offset=` (returns array by default; returns `{items,total,limit,offset}` when `limit`/`offset` provided), `POST /api/campaigns`
- `GET /api/campaigns/:id?status=sent|opened|clicked|submitted|pending&includeTargets=false`, `GET /api/campaigns/:id/summary`, `GET /api/campaigns/:id/targets?status=&limit=&offset=` (array by default; paginated envelope when `limit`/`offset` provided), `GET /api/campaigns/:id/targets/:targetId` (campaign-scoped target detail; 404 if target not in campaign), `GET /api/campaigns/:id/targets/:targetId/events?type=&from=&to=&limit=&offset=` (ownership-validated, paginated, date filters validated), `GET /api/campaigns/:id/targets/:targetId/events.csv?type=&from=&to=` (ownership-validated, 404/405-safe), `GET /api/campaigns/:id/targets.csv?status=` (alias), `GET /api/campaigns/:id/events?type=&targetId=&from=&to=&limit=&offset=` (date filters validated), `GET /api/campaigns/:id/events.csv?targetId=&type=&from=&to=`, `DELETE /api/campaigns/:id` (demo hygiene), `POST /api/campaigns/:id/targets`, `GET /api/campaigns/:id/stats?from=&to=`, `GET /api/campaigns/:id/export.csv`
- `POST /api/campaigns/:id/send`
- `GET /api/targets/recent?limit=&offset=&campaignId=&status=`, `GET /api/targets/:id?campaignId=` (optional ownership-validated `campaignId`; includes `campaignName`, `eventCount`, `eventCounts`, `lastEventAt`; 404-safe), `GET /api/targets/:id/events?type=&from=&to=&limit=&offset=&campaignId=` (optional ownership-validated `campaignId`), `GET /api/targets/:id/events.csv?type=&from=&to=&campaignId=` (alias: `/api/targets/:id.csv`; optional ownership-validated `campaignId`; 404/405-safe), `GET /api/targets/export.csv?campaignId=&status=` (alias: `/api/targets.csv`), `POST /api/targets/:id/click`
- `GET /api/events?campaignId=&targetId=&type=&from=&to=&limit=&offset=`, `POST /api/events` (`{ targetId, type: opened|clicked|submitted }`), `DELETE /api/events/:id`, `GET /api/events/export.csv?campaignId=&targetId=&type=&from=&to=` (alias: `/api/events.csv`)

`/api/*` responses use JSON error objects and return `405` for known campaign routes with unsupported methods. The server adds basic security headers and safe static-file resolution.

## UI notes
- Target detail modal: campaign-scoped/global scope label, target metadata, recent events with `type`/`from`/`to` filters, **Apply/Clear**, pagination (**Load more events**, shown/total), **Export Events CSV**, **Copy CSV link**, **Copy events link** (JSON with active filters), **Copy JSON**, and **Show in Recent Events**. UI passes campaign context when known; `GET /api/targets/:id?campaignId=` supports ownership-validated lookup.
- Recent Events toolbar/panel: scope indicator, filters (including from/to + target in global scope), export link, **Copy CSV link**, **Copy JSON link**, **Open target detail** (when target filter set; uses unambiguous resolved campaign context when available), **Load more**, and row actions (**Details**, **Target** when event has targetId, **Delete**). Global target-filtered views may show resolved campaign context in scope/meta when unambiguous (global pagination/export semantics remain primary). Row **Details** uses `GET /api/events/:id`.

## Swapping the database
`src/db.js` exposes plain functions (`createCampaign`, `listCampaigns`, `recordEvent`, `stats`, etc.). Replace JSON reads/writes with SQLite/Postgres calls while keeping the same function contracts used by `src/server.js`.

