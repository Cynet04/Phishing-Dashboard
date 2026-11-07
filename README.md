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

## API
- `GET /api/health`
- `GET /api/templates`, `POST /api/templates`, `PUT /api/templates/:id`, `DELETE /api/templates/:id`
- `GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/campaigns`, `POST /api/campaigns`
- `GET /api/campaigns/:id`, `DELETE /api/campaigns/:id` (demo hygiene), `GET /api/campaigns/:id/stats?from=&to=`, `GET /api/campaigns/:id/export.csv`
- `POST /api/campaigns/:id/send`
- `GET /api/targets/recent?limit=&offset=`, `GET /api/targets/export.csv`, `POST /api/targets/:id/click`
- `POST /api/events` (`{ targetId, type: opened|clicked|submitted }`)

`/api/*` responses use JSON error objects and return `405` for known campaign routes with unsupported methods. The server adds basic security headers and safe static-file resolution.

## Swapping the database
`src/db.js` exposes plain functions (`createCampaign`, `listCampaigns`, `recordEvent`, `stats`, etc.). Replace JSON reads/writes with SQLite/Postgres calls while keeping the same function contracts used by `src/server.js`.
