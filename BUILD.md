# Kanzen — Build status

Implementation lives on the **`build`** branch (the plan + specs are on `spec`). Built strictly to the specs in `specs/` and the conventions in `CLAUDE.md`.

## What runs today (F00 — Foundation)
A real, compiling, **fully test-backed** foundation across backend + web, demonstrating **every test type**:

| Layer | What's built | Tests | Status |
|---|---|---|---|
| **Backend app** | Scala 2.13 · cats-effect · http4s Ember · Tapir + Swagger (`/api/health`, `/docs`) | weaver **server** test on the real route | ✅ |
| **Backend units** | `Health` domain | ScalaTest **FreeSpec** unit tests | ✅ |
| **Backend DB** | Doobie + Flyway · `V1_0_0__baseline.sql` (extensions + `audit_log_entries`) | weaver **integration** test — real **Postgres 16** via **Testcontainers**, Flyway-migrated, round-trip | ✅ |
| **Web shell** | Vite · React 19 · **StyleX** tokens + `Pill` + grouped-nav shell (SPEC §5/§16) | **Vitest** UI/unit tests | ✅ |
| **Web e2e** | the shell in a real browser | **Playwright** (Chromium, StyleX runtime-injected) | ✅ |

**Verified locally:** backend **`57/57`** (13 features), web **Vitest `12/12`** + **Playwright `6/6`** (5 UI features).

### Features implemented so far (tested)
- **Backend (13):** F00 foundation · F01 identity · F02 attribute-level RBAC · F03 properties + nested locations · F04 asset registry (categories tree, **JSONB attributes**, tracking modes) · F08 lists (propose→approve, buy URLs) · F09 vendors (insurance gating) · F10 people (permit expiry) · F15 bills (±15% variance) · F17 expenses & approvals (threshold routing) · F19 lifecycle events + lifetime cost · F20 valuation (latest-by-kind) · F35 products/stock (out→reorder).
- **Web (5 UI features):** StyleX shell + routing · **Inventory** (grid+filter) · **Finance** (approvals) · **Properties** (cards) · **People** (permit warning) — each with Vitest UI tests + Playwright browser e2e.

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
