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
npm test
```

## Features
- **Overview metrics:** total campaigns, emails sent, click rate, data submitted rate.
- **Activity chart:** recent click/submit event bars.
- **Campaign management:** create campaign with name, target email list, template.
- **Simulation engine:** send simulation marks targets as sent; `/login-simulation` mock hook records submit and redirects to `/education`.
- **Dashboard actions:** simulate click events for testing.

## API
- `GET /api/health`
- `GET /api/templates`
- `GET /api/campaigns`, `POST /api/campaigns`
- `GET /api/campaigns/:id`, `GET /api/campaigns/:id/stats`
- `POST /api/campaigns/:id/send`
- `GET /api/targets/recent`, `POST /api/targets/:id/click`
- `POST /api/events` (`{ targetId, type: opened|clicked|submitted }`)

## Swapping the database
`src/db.js` exposes plain functions (`createCampaign`, `listCampaigns`, `recordEvent`, `stats`, etc.). Replace JSON reads/writes with SQLite/Postgres calls while keeping the same function contracts used by `src/server.js`.
