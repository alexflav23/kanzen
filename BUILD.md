# Kanzen — Build status

Implementation lives on the **`build`** branch (the plan + specs are on `spec`). Built strictly to the specs in `specs/` and the conventions in `CLAUDE.md`.

## Honest status — NOT implementation-complete

Earlier revisions of this file said "all 38 features complete." That was wrong:
it counted **tested code modules**, not features a user can actually use. The
three layers (backend / web / mobile) **do not connect** — nothing flows
UI → API → DB → integration. Realistic product completion: **~15–20%**,
concentrated in backend domain logic and the design system.

### What is actually real
- **Design system + theme engine** ✅ — StyleX tokens + `createTheme` light/dark
  + `ThemeContext` (⌘D, persistence) + **static CSS extraction**. Working.
- **Backend domain logic** — 48 repo/service files (~37 feature areas) with
  **126 passing tests** (FreeSpec + weaver + Testcontainers/Postgres 16). Real,
  but **isolated**: the running server only serves `/api/health` + `/docs`.
  Only ~2 files define HTTP endpoints; the rest is not wired to anything.
- **Web** — **5 of 17** nav screens built (Dashboard, Inventory, Finance,
  Properties, People) + 2 detail views, deepened to the `input/` design. The
  other **12 are "Coming soon" stubs**. All screens run on **mock data — not
  connected to the backend.**
- **Mobile** — a 5-screen Flutter shell on mock data.

### What is NOT done (the bulk of the work)
- **API layer**: Tapir endpoints for the ~37 feature areas, wired into the
  server (today only `/health` is served).
- **Web ↔ backend**: hand-written services + Zod replacing every mock module;
  auth (Cognito) on the client.
- **Real integrations**: Cognito, GoCardless, Bedrock, Gmail/Calendar/Drive, S3,
  TigerBeetle, Pulsar — currently **simulated in logic, no live clients**
  (operator inputs tracked in `SETUP.md`).
- **Remaining ~12 web screens** (Inbox, Triage, Calendar, Insights, Collections,
  Lists, Backup, Vendors, Vehicles, Documents, Tasks, Settings/RBAC matrix).
- **Mobile**: the capture-first Triage flow + real data.

### Test counts (real, but they only cover the above)
backend **126** (domain logic, isolated) · web **Vitest 14** + **Playwright 21**
(5 mock-data screens + theme) · mobile **Flutter 6** (shell). Green — but green
≠ shipped; they test the modules that exist, not an end-to-end product.

### Backend domain modules with tests (code exists, not served via API)
F00 foundation · F01 identity · F02 RBAC · F03 properties · F04 assets (JSONB) ·
F05 documents · F06 tasks · F07 calendar · F08 lists · F09 vendors · F10 people ·
F11 maintenance · F12 bank ingest · F13 receipts · F14 reconciliation · F15 bills ·
F16 pay queue · F17 expenses · F18 ledger · F19 lifecycle · F20 valuation ·
F21 warranty · F22 templates · F23 completeness · F24 restructure · F25 agent ·
F26 inbox · F27 trust · F28 search · F29 insights · F30 backup · F32 NL query ·
F33 extensibility · F34 events · F35 products · F36 replenishment · F37 FX.

## Run it
```bash
# Backend (needs Docker running for the integration test)
cd backend && sbt test            # FreeSpec + weaver + Testcontainers IT
cd backend && sbt run             # serve :8080 (/api/health, /docs)

# Web
cd web && npm install
cd web && npm test                # Vitest (UI + unit)
cd web && npx playwright install chromium && npm run e2e   # Playwright browser e2e

# Local stack
docker compose up                 # Postgres 16 + LocalStack + TigerBeetle
```
CI runs all three suites — see `.gitlab-ci.yml`.

## Honest roadmap
This is **F00 of 38 features (F00–F37)**. The foundation is complete and green; the remaining features (identity/auth, RBAC, properties, the asset registry, finance/ledger, the agent, search, etc.) are a large, ongoing build delivered milestone-by-milestone, each as a tested increment against its `specs/F__-*.md`. Several features additionally require the external inputs in `SETUP.md` (AWS, Cognito, GoCardless, Bedrock, Google Workspace) before they can run beyond mocked/local tests.

**Next slices:** typed config loading (Hypervolt `ValidatedNel` pattern) · admin/health `:9990` + metrics `:9464` · F01 identity model (users/login_identities/sessions) + auth middleware · F02 RBAC enforcement — each with unit + integration + (where UI) Vitest/Playwright tests.
