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

## Phase 9 — Template Management (complete)
- [x] Seed/template compatibility preserved (existing template IDs remain valid)
- [x] CRUD API for custom email templates stored in JSON DB (`/api/templates`, GET/POST/PUT/DELETE) with validation/tests — 11/11 passing
- [x] Dashboard template management UI + live preview of selected template
- [x] Run verification, docs/log updates, commit/push per item

## Phase 10 — Security & Auth (complete)
- [x] Add optional admin auth via `ADMIN_PASSWORD` env: login/status/logout endpoints, signed session cookie, protect dashboard/API routes (`/api/health` and simulation pages exempt) with tests — 12/12 passing (`5d2d2b6`)
- [x] Add dashboard login/logout UI affordance and graceful auth-disabled behavior
- [x] Update docs/logs and commit/push per item

## Phase 11 — Edge Cases & Validation (complete)
- [x] Enforce campaign/template input limits and clearer validation errors (name/body/target count) with tests — 13/13 passing (`0768a88`)
- [x] Validate stats date filter format (`YYYY-MM-DD`) and return 400 on invalid ranges; add tests
- [x] Add dashboard toast notifications for create/delete/send/simulate actions (non-blocking UX)
- [x] Run verification, docs/log updates, commit/push per item

## Phase 12 — Performance & Robustness (complete)
- [x] Baseline verification: 13/13 tests passing (`node --test --test-concurrency=1`)
- [x] Add defensive request body size/error handling coverage and regression tests — 14/14 passing
- [x] Optimize/simplify DB read helpers where safe (reviewed; no behavior-risky refactor required this pass)
- [x] Run verification, docs/log updates, commit/push per item

## Phase 14 — UI/UX Polish (complete)
- [x] Add theme toggle (dark/light) with `localStorage` persistence and responsive refinements — 15/15 tests passing (`e23e7aa`)
- [x] Add non-disruptive loading/error states for dashboard refresh actions (button state + toast on failure)
- [x] Run verification, docs/log updates, commit/push per item

## Phase 15 — Expansion (complete)
- [x] Add CSV export for events (`/api/events/export.csv`, optional campaign filter and per-campaign route) with tests — 16/16 passing
- [x] Add dashboard action/link for event CSV export
- [x] Run verification, docs/log updates, commit/push per item

## Phase 16 — Expansion (complete)
- [x] Add event list API endpoint with pagination/filter (`/api/events?campaignId=&type=&limit=&offset=`) and tests — 17/17 passing
- [x] Add basic events table in dashboard (recent events) with load controls
- [x] Run verification, docs/log updates, commit/push per item

## Phase 17 — Expansion (complete)
- [x] Add campaign target CSV/upload-style import endpoint (`POST /api/campaigns/:id/targets`) with validation/dedup and tests — 18/18 passing (`e70a7b1`)
- [x] Add dashboard UI for importing targets into a selected campaign
- [x] Run verification, docs/log updates, commit/push per item

## Phase 18 — Expansion (complete)
- [x] Add per-campaign events CSV export regression test (`GET /api/campaigns/:id/events.csv`) — 20/20 passing
- [x] Add template delete regression test for non-existent/missing IDs (clear 404)
- [x] Verify API/UI behavior coverage remains green (simulate submit/click flows already covered by tests)
- [x] Run verification, docs/log updates, commit/push per item

## Phase 19 — Expansion (complete)
- [x] Add campaign detail API to include `statusCounts`, `targetCount`, and `eventCount` summary (backward-compatible) — 21/21 passing (`b1336d3`)
- [x] Add tests for campaign detail summary fields
- [x] Run verification, docs/log updates, commit/push per item

## Phase 20 — Expansion (complete)
- [x] Add `/api` method/not-found consistency regression tests (405/404 JSON behavior)
- [x] Add per-campaign `events.csv` link in campaign detail UI (selected campaign)
- [x] Run verification, docs/log updates, commit/push per item — 22/22 passing

## Phase 21 — Expansion (complete)
- [x] Add dashboard display of campaign detail summary counts (`targetCount`/`eventCount`) for clarity — 22/22 passing
- [x] Keep API/export regression coverage stable (per-campaign events CSV assertions present)
- [x] Run verification, docs/log updates, commit/push per item (`de64106`)

## Phase 22 — Expansion (complete)
- [x] Add `/api/events` ordering (newest-first) regression assertions
- [x] Add root static `/` and `/styles.css` smoke checks (safe static routing/content-type) — 24/24 passing
- [x] Run verification, docs/log updates, commit/push per item

## Phase 23 — Expansion (complete)
- [x] Add CSV export for a single campaign’s targets via dashboard campaign detail link (existing endpoint)
- [x] Add regression test for per-campaign targets CSV response headers/content — 25/25 passing
- [x] Run verification, docs/log updates, commit/push per item

## Phase 24 — Expansion (complete)
- [x] Add `/api/auth/status` regression coverage for disabled default state — 26/26 passing
- [x] Add dashboard handling for 401 API responses (redirect to `/login` when auth enabled)
- [x] Run verification, docs/log updates, commit/push per item

## Phase 25 — Expansion (complete)
- [x] Add `GET /api/campaigns/:id` 404 test and ensure error payload consistency — 27/27 passing
- [x] Reset/clear campaign status filter UX hint preserved (detail UI already supports filter control)
- [x] Run verification, docs/log updates, commit/push per item

## Phase 26 — Expansion (complete)
- [x] Add `events` list API test for unknown campaign/type filter (empty result, stable shape) — 28/28 passing
- [x] Add dashboard defensive rendering for missing recent event fields
- [x] Run verification, docs/log updates, commit/push per item

## Phase 27 — Expansion (complete)
- [x] Add `GET /api/campaigns/:id/export.csv` and `events.csv` 404 handling for unknown campaign with tests — 29/29 passing
- [x] Keep dashboard/analytics behavior stable
- [x] Run verification, docs/log updates, commit/push per item

## Phase 28 — Expansion (complete)
- [x] Add JSON `GET /api/campaigns/:id/targets` endpoint (status filter support) and tests — 31/31 passing
- [x] Add template ID default override protection (cannot modify built-in templates via PUT) and tests
- [x] Run verification, docs/log updates, commit/push per item

## Phase 29 — Expansion (complete)
- [x] Add defensive 405 handling for events endpoint methods not supported and regression test — 32/32 passing
- [x] Add dashboard campaign detail quick status counts display (uses `statusCounts`)
- [x] Run verification, docs/log updates, commit/push per item

## Phase 30 — Expansion (complete)
- [x] Add `GET /api/targets/recent` and `GET /api/events` query clamp/validation regression tests (negative/zero limit/offset) — 33/33 passing
- [x] Confirmed clamping behavior in DB layer (no unsafe behavior observed)
- [x] Run verification, docs/log updates, commit/push per item

## Phase 31 — Expansion (active)
- [ ] Add `POST /api/campaigns` validation for missing/invalid JSON body shape and test
- [ ] Add dashboard-safe handling for template save when body/subject missing (already API-validated; improve UX message) with no test regression
- [ ] Run verification, docs/log updates, commit/push per item

