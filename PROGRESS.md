# Progress Log

## 2026-11-07 08:24Z — Initial scan
- Workspace was empty (fresh git repo, remote `origin https://github.com/Cynet04/Phishing-Dashboard`).
- Created initial backlog.

## 2026-11-07 08:27Z — Full implementation pass
- Re-planned against requested 5-phase scope; updated `TASKS.md`.
- Environment blocker: no Node.js/npm, no usable Python runtime. Chose a zero-dependency Node 18+ architecture (built-in `http`, `fs`, `crypto`, `node:test`) so the project is runnable without package installs and has a clean data-layer seam for swapping to a real DB.
- Implemented:
  - **Data layer** (`src/db.js`): JSON-backed storage; schema for campaigns, targets, events; helpers for create/list, send simulation, click/open/submit events, per-campaign stats. Designed so functions can be replaced with DB calls.
  - **Templates** (`src/templates.js`): mock phishing templates (educational).
  - **Server/API** (`src/server.js`): static UI, health, campaign CRUD, send simulation, simulate-click endpoint, event ingestion, stats, `/login-simulation` mock hook, `/education` page.
  - **UI** (`public/index.html`, `public/styles.css`, `public/app.js`): modern dark dashboard; overview metrics; bar chart; recent targets table; campaign create form (name, target emails, template); campaign detail; send simulation and simulate-click controls.
  - **Tests** (`test/api.test.js`): API smoke tests for health, campaign create/list, send, stats/events flow.
  - **Docs** (`README.md`, `.gitignore`).
- Verification: blocked in current environment; documented exact commands for Node host.
## 2026-11-07 09:14Z — Environment restored, verification complete
- Environment fixed: Node v26.13.0 / npm 11.20.0 available at `C:\Program Files\nodejs` (PowerShell execution policy blocks `npm.ps1`; used `npm.cmd`/`node --test` directly).
- Fixed DB/test isolation: `src/db.js` now resolves `PHISH_DASH_DB` dynamically per operation and exposes `dbFile()`; `test/api.test.js` uses `db.resetForTests()` to avoid cross-test pollution.
- Verification:
  - `node --test --test-concurrency=1 test/api.test.js` — 2/2 passing.
  - End-to-end sanity check against running server: `/api/health` OK; created campaign (2 targets); send simulation OK; stats reported sent=2.
- Git: local commits confirmed synced with `origin/main` (`Everything up-to-date`).
## 2026-11-07 09:22Z — Hardening pass
- Fixed UI encoding/mojibake artifacts in `public/app.js`.
- Hardened campaign creation in `src/db.js`: validates email format, deduplicates targets, rejects empty/invalid target sets with 400.
- Expanded `test/api.test.js` to 4 cases (health, send/click/submit, validation+opened flow, unknown target error).
- `node --test --test-concurrency=1 test/api.test.js` — 4/4 passing.
## 2026-11-07 09:24Z — Opened-event tracking fix
- Fixed lifecycle gap: `GET /login-simulation?target=...` now records an `opened` event (best-effort, non-blocking for page render) so target status/analytics reflect link opens.
- Repaired accidental test-structure corruption and added regression test for landing-page open tracking.
- `node --test --test-concurrency=1 test/api.test.js` — 5/5 passing.
- `node --check` passed for modified server/test files.
## 2026-11-07 11:30Z — Phase 52: dashboard auto-refresh
- Added Auto-refresh toggle (30s), persisted in `localStorage` (`pd-auto-refresh`) with interval cleanup; manual Refresh still works.
- `node --check` (ui); `node --test --test-concurrency=1` — 48/48 passing. Committed/pushed. Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5). View: header **Auto: off/on** + **Refresh**.

## 2026-11-07 11:36Z — Phase 58: filtered events CSV export
- `/api/events/export.csv` accepts optional `type` filter (backward-compatible) in addition to `campaignId`. Added regression test; README updated.
- `node --check` (server/tests); `node --test --test-concurrency=1` — 52/52 passing. Committed/pushed.

## 2026-11-07 11:37Z — Phase 59: filtered events export UI
- Dashboard Recent Targets section now includes events export type filter (`opened/clicked/submitted`) updating `GET /api/events/export.csv?type=` link.
- `node --check` (ui); `node --test --test-concurrency=1` — 52/52 passing. Committed/pushed (`5994b2d`, force-with-lease after amend). Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5, restarted). View: Recent Targets controls → events type dropdown → **Export Events CSV**.

## 2026-11-07 11:40Z � Phase 62: campaign targets filtered CSV export route
- Added `GET /api/campaigns/:id/targets/export.csv?status=` (404-safe, reuses filtered export). Added regression test; README updated.
- `node --check` (server/tests); `node --test --test-concurrency=1` � 54/54 passing. Committed/pushed. Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5).

## 2026-11-07 11:41Z � Phase 63: campaign filtered export UI
- Campaign detail adds **Export Filtered Targets** link that follows the selected status filter (`/api/campaigns/:id/targets/export.csv?status=`) alongside **Export All Targets**.
- `node --check` (ui); `node --test --test-concurrency=1` � 54/54 passing. Committed/pushed (`5994b2d`, force-with-lease after amend). Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5). View: Campaign Detail ? filter status ? **Export Filtered Targets**.

## 2026-11-07 11:42Z � Phase 64: template endpoint coverage
- Added API test for `GET /api/templates` shape and custom template delete 404 (documents current PUT-upsert behavior for unknown custom IDs).
- `node --check` (tests); `node --test --test-concurrency=1` � 55/55 passing. Committed/pushed. Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5).

## 2026-11-07 11:43Z � Phase 65: JSON no-store cache hardening
- Server `send()` now sets `Cache-Control: no-store` for object/JSON responses (API data and JSON errors) while preserving existing security headers. Health test asserts header.
- `node --check` (server/tests); `node --test --test-concurrency=1` � 55/55 passing. Committed/pushed (`5994b2d`, force-with-lease after amend). Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5).

## 2026-11-07 11:44Z � Phase 66: target detail modal UX/accessibility
- Target detail modal now supports **Copy JSON** (clipboard with prompt fallback), stores fetched target+events JSON, closes on Escape/click-outside, and focuses the close control.
- `node --check` (ui/app.js); `node --test --test-concurrency=1` � 55/55 passing. Committed/pushed. Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5). View: Recent Targets ? **Details** ? **Copy JSON** / press **Esc**.

## 2026-11-07 11:45Z � Phase 67: events CSV target filter
- `/api/events/export.csv` accepts optional `targetId` (404-safe for unknown target) alongside existing filters. Added regression test; README updated.
- `node --check` (db/server/tests); `node --test --test-concurrency=1` � 56/56 passing. Committed/pushed. Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5).

## 2026-11-07 11:46Z � Phase 68: target detail export-events action
- Target detail modal includes **Export Events CSV** for the selected target (`/api/events/export.csv?targetId=`), alongside Copy JSON and accessibility behavior.
- `node --check` (ui/app.js); `node --test --test-concurrency=1` � 56/56 passing. Committed/pushed. Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5). View: Recent Targets ? **Details** ? **Export Events CSV**.

## 2026-11-07 11:47Z � Phase 69: delete event API
- Added `DELETE /api/events/:id` (404-safe, 405 for unsupported methods) and DB `deleteEvent()`. README updated; regression test added.
- `node --check` (db/server/tests); `node --test --test-concurrency=1` � 57/57 passing. Committed/pushed (`5994b2d`, force-with-lease after amend). Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5).

## 2026-11-07 11:46Z � Phase 68: target detail export-events action
- Target detail modal includes **Export Events CSV** for the selected target (`/api/events/export.csv?targetId=`), alongside Copy JSON and accessibility behavior.
- `node --check` (ui/app.js); `node --test --test-concurrency=1` � 56/56 passing. Committed/pushed (`5994b2d`, force-with-lease after amend). Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5). View: Recent Targets ? **Details** ? **Export Events CSV**.

## 2026-11-07 11:48Z � Phase 70: Recent Events delete UI
- Recent Events table now includes per-row **Delete** (confirm) calling `DELETE /api/events/:id`, then reloads events and system status with toast/error handling.
- `node --check` (ui); `node --test --test-concurrency=1` � 57/57 passing. Committed/pushed. Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5). View: **Recent Events** ? **Delete** on a row.

## 2026-11-07 11:49Z � Phase 71: campaign events.csv filter passthrough
- `GET /api/campaigns/:id/events.csv` now forwards `type` and `targetId` filters to event export (backward-compatible). Added regression test.
- `node --check` (server/tests); `node --test --test-concurrency=1` � 58/58 passing. Committed/pushed. Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5).

## 2026-11-07 11:50Z � Phase 72: target route method consistency
- `GET /api/targets/:id` and `GET /api/targets/:id/events` enforce GET-only handling (405 for unsupported methods). Added regression test.
- `node --check` (server/tests); `node --test --test-concurrency=1` � 59/59 passing. Committed/pushed. Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5).

## 2026-11-07 11:51Z � Phase 73: export/targets toolbar clear filters
- Added **Clear filters** for Recent Targets/export toolbar; reorganized controls and wired clear to reset campaign/status/events-export filters and reload targets.
- `node --check` (ui); `node --test --test-concurrency=1` � 59/59 passing. Committed/pushed (`5994b2d`, force-with-lease after amend). Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5). View: Recent Targets toolbar ? **Clear filters**.

## 2026-11-07 11:52Z � Phase 74: /api/events targetId filter passthrough
- `GET /api/events` now passes `targetId` to event listing (DB already supported). README updated; regression test added.
- `node --check` (server/tests); `node --test --test-concurrency=1` � 60/60 passing. Committed/pushed. Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5).

## 2026-11-07 11:53Z � Phase 75: Recent Events target filter UI
- Recent Events panel adds **Target ID filter** input and **Clear** controls; UI passes `targetId` to `/api/events` and shows filter in meta.
- `node --check` (ui); `node --test --test-concurrency=1` � 60/60 passing. Committed/pushed (`5994b2d`, force-with-lease after amend). Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5). View: **Recent Events** ? Target ID filter / Clear.

## 2026-11-07 11:51Z � Phase 73: export/targets toolbar clear filters
- Added **Clear filters** for Recent Targets/export toolbar; reorganized controls and wired clear to reset campaign/status/events-export filters and reload targets.
- `node --check` (ui); `node --test --test-concurrency=1` � 59/59 passing. Committed/pushed. Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5). View: Recent Targets toolbar ? **Clear filters**.

## 2026-11-07 11:50Z � Phase 72: target route method consistency
- `GET /api/targets/:id` and `GET /api/targets/:id/events` enforce GET-only handling (405 for unsupported methods). Added regression test.
- `node --check` (server/tests); `node --test --test-concurrency=1` � 59/59 passing. Committed/pushed. Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5).

## 2026-11-07 11:55Z — Phase 77: campaign detail quick view events
- Campaign detail adds **View Campaign Events**: scopes Recent Events to selected campaign via /api/campaigns/:id/events, clears local event filters, scrolls to panel (scoped quick view disables global Load More until filters/refresh return to global list).
- 
ode --check (ui); 
ode --test --test-concurrency=1 — 60/60 passing. Committed/pushed. Dashboard: http://localhost:3000 (bgp_1b5dbc2ac001bDJPDFL4r16xd5). View: open a campaign → **View Campaign Events**.

## 2026-11-07 11:56Z — Phase 78: events scope recovery
- Fixed recovery from campaign-scoped quick view: global events loader resets scope/campaign context and restores pagination; filters/Clear/Refresh return to global `/api/events`. Scoped quick view meta indicates how to return to global list.
- `node --check` (ui); `node --test --test-concurrency=1` — 60/60 passing. Committed/pushed. Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5).

## 2026-11-07 11:58Z — Phase 80: target detail “Show in Recent Events”
- Target detail modal adds **Show in Recent Events**: prefills `targetId` filter, clears campaign-scoped quick view/type filter, reloads global `/api/events`, closes modal, scrolls to panel.
- `node --check` (ui); `node --test --test-concurrency=1` — 60/60 passing. Committed/pushed (`5994b2d`, force-with-lease after amend). Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5). View: open a target detail → **Show in Recent Events**.

## 2026-11-07 11:57Z — Phase 79: campaign events combined filter regression
- Strengthened campaign events JSON test: asserts `targetId+type` combined filtering and stable empty result for mismatched target/type (route behavior already correct).
- `node --test --test-concurrency=1` — 60/60 passing. Committed/pushed (`5994b2d`, force-with-lease after amend). Dashboard: `http://localhost:3000` (bgp_1b5dbc2ac001bDJPDFL4r16xd5).

## 2026-11-07 11:59Z — Phase 81: targets recent/export method consistency
- `GET /api/targets/recent` and `GET /api/targets/export.csv` enforce GET-only handling (405 for unsupported methods). Added regression test.
- `node --check` (server/tests); `node --test --test-concurrency=1` — 61/61 passing. Committed/pushed (3d22291). Dashboard: http://localhost:3000 (bgp_1b5dbc2ac001bDJPDFL4r16xd5).

## 2026-11-07 13:57Z — Phase 82: Recent Targets Events quick action
- Recent Targets rows now include an **Events** quick action. It reuses the global-scope target-events recovery flow (Phase 80/78): prefills Recent Events `targetId` filter, clears campaign-scoped/type state, reloads global `/api/events`, and scrolls to the panel.
- `node --check` (ui); `node --test --test-concurrency=1` — 61/61 passing. Committed/pushed (`5994b2d`, force-with-lease after amend). Dashboard: http://localhost:3000 (bgp_1b5dbc2ac001bDJPDFL4r16xd5). View: **Recent Targets** → row **Events**.

## 2026-11-07 14:15Z � Phase 83: campaign-scoped events Global list recovery
- Recent Events adds **Global list** control when campaign-scoped quick view is active. It clears scope/filters and reloads global /api/events with normal pagination; control hides in global view.
- 
ode --check (ui); 
ode --test --test-concurrency=1 � 61/61 passing. Committed/pushed. Dashboard: http://localhost:3000 (bgp_1b5dbc2ac001bDJPDFL4r16xd5). View: campaign **View Campaign Events** ? **Global list**.
