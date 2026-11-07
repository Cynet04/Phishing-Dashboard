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
- [x] Run tests/build in environment (Node v26.13.0/npm 11.20.0; `node --test` passing)
- [x] Commit with Conventional Commits locally
- [x] Push to origin/main (verified: `git push origin main` up-to-date / synced)

## Notes / Blockers
- 2026-11-07 08:27Z: Initial blockers (no Node/npm, no push auth) resolved by environment fix.
- 2026-11-07 09:14Z: Verified Node v26.13.0 at `C:\Program Files\nodejs`. Smoke tests pass (2/2). End-to-end server sanity check passed (health, create campaign, send simulation, stats). Local commits pushed/synced to `origin/main`.

## Phase 8 — Advanced Analytics (complete)
- [x] Add CSV export for campaign/global targets (API + dashboard action) with tests — 8/8 passing (`ea9c73e`)
- [x] Add recent targets pagination (`limit`/`offset`) and UI "Load more" with tests — 9/9 passing (`a2dc520`)
- [x] Add campaign stats timeline filtering by date range (API) with tests — 10/10 passing
- [x] Run verification, docs/log updates, commit/push per item

## Phase 9 — Template Management (expansion)
- [ ] CRUD API for email templates (stored in JSON DB) with tests
- [ ] Dashboard template management UI + live preview

## Phase 10 — Security & Auth (expansion)
- [ ] Optional admin login screen/token for dashboard/API (env-configured) with tests

## Phase 11 — UI/UX Polish (expansion)
- [ ] Toast notifications, dark/light toggle persistence, responsive refinements

## Phase 12 — Edge Cases & Performance (expansion)
- [ ] Additional validation/pagination/query optimizations as needed

