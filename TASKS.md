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

## Phase 7 — Continuous hardening (in progress)
- [x] Add method-not-allowed/validation coverage and safe API method handling
- [x] Add campaign delete/reset capability for demo hygiene (API + UI action) with tests
- [x] Add regression test for form-urlencoded landing simulation submit path (fixed server body parsing)
- [x] Run full verification (7/7 passing)
- [ ] Update docs/logs and commit/push Phase 7 batch
- [ ] Continue with additional safe improvements if time remains

