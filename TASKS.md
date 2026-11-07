# Phishing Dashboard — Tasks

## Phase 1: Project Scaffolding & Database
- [x] Set up project structure (backend API + static frontend), zero external deps
- [x] Create database schema/storage: Campaigns, Targets (emails), Click/Submit Events
- [x] JSON-file storage mock (swappable data layer in `src/db.js`)
- [x] `package.json` scripts (`start`, `dev`, `test`), `.gitignore`

## Phase 2: Dashboard UI (Core)
- [x] Sleek modern dashboard interface (dark theme, responsive layout)
- [x] Overview metrics: Total Campaigns, Emails Sent, Click Rate, Data Submitted Rate
- [x] Bar chart showing clicks/submits over recent campaigns/time buckets
- [x] Data table showing recent targets and status (Sent, Opened, Clicked, Submitted)

## Phase 3: Campaign Management
- [x] UI page/form to create a new campaign
- [x] Fields: Campaign Name, Target Email List, Template selection
- [x] API endpoint to handle campaign creation (`POST /api/campaigns`)

## Phase 4: Simulated Phishing Engine (Educational)
- [x] Mock phishing email template definitions (`src/templates.js`)
- [x] "Send Simulation" function/API updates target status to Sent (`POST /api/campaigns/:id/send`)
- [x] Mock landing page `/login-simulation` records submit event and redirects to educational page

## Phase 5: Analytics & Data Integration
- [x] Landing page interactions update dashboard metrics via events API
- [x] "Simulate Click" button in UI for testing target click events
- [x] Campaign stats endpoint powers metrics/chart

## Quality & Delivery
- [x] API smoke tests (`test/api.test.js`, Node test runner)
- [x] `README.md` with setup/run/swap notes
- [ ] Run tests/build in environment (BLOCKED: Node.js/npm not installed; Python unusable)
- [x] Commit with Conventional Commits and push to origin/main

## Notes / Blockers
- 2026-11-07: No Node.js/npm runtime and no usable Python in this execution environment (`npm` not found; `python` is a Windows Store alias). Implemented a complete, dependency-free Node 18+ app so it runs immediately where Node is available. Runtime verification must be performed on a Node-capable machine: `npm test && npm start`.
