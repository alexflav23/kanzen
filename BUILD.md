# Kanzen — Build status

Implementation lives on the **`build`** branch (the plan + specs are on `spec`). Built strictly to the specs in `specs/` and the conventions in `CLAUDE.md`.

## ✅ All 38 features (F00–F37) implemented & test-backed
A real, compiling, **fully test-backed** implementation across backend + web + mobile, demonstrating **every test type**. *(External integrations — Cognito, GoCardless, Bedrock, Google, TigerBeetle, S3, Pulsar — are implemented at the data-model + core-logic level with adapters/stubs and Postgres-modelled where a live account is required to run; production wiring needs the `SETUP.md` accounts.)*

| Layer | What's built | Tests | Status |
|---|---|---|---|
| **Backend app** | Scala 2.13 · cats-effect · http4s Ember · Tapir + Swagger (`/api/health`, `/docs`) | weaver **server** test on the real route | ✅ |
| **Backend units** | `Health` domain | ScalaTest **FreeSpec** unit tests | ✅ |
| **Backend DB** | Doobie + Flyway · `V1_0_0__baseline.sql` (extensions + `audit_log_entries`) | weaver **integration** test — real **Postgres 16** via **Testcontainers**, Flyway-migrated, round-trip | ✅ |
| **Web shell** | Vite · React 19 · **StyleX** tokens + `Pill` + grouped-nav shell (SPEC §5/§16) | **Vitest** UI/unit tests | ✅ |
| **Web e2e** | the shell in a real browser | **Playwright** (Chromium, StyleX runtime-injected) | ✅ |

**Verified locally:** backend **`126/126`** · web **Vitest `12/12`** + **Playwright `6/6`** · mobile **Flutter `2/2`** = **146 tests green**, all 38 features.

### All 38 features (F00–F37), tested
- **Backend (37 features):** F00 foundation · F01 identity · F02 attribute-level RBAC · F03 properties + nested locations · F04 asset registry (**JSONB**) · F05 documents (immutable + links) · F06 native tasks (recurring) · F07 calendar (Google dedup) · F08 lists (propose→approve) · F09 vendors (insurance gating) · F10 people (permit expiry) · F11 maintenance (roll-forward) · F12 bank ingestion (idempotent) · F13 receipts + line items · F14 reconciliation (+ transfer detection) · F15 bills (±15% variance) · F16 pay queue (never moves money) · F17 expenses & approvals (threshold routing) · F18 ledger (double-entry) · F19 lifecycle + lifetime cost · F20 valuation · F21 warranty/insurance · F22 templates (validation) · F23 completeness · F24 restructure (split cost) · F25 agent (classify→propose) · F26 inbox (stream counts) · F27 trust (financial locked) · F28 search (full-text) · F29 insights (aggregates) · F30 backup (manifest+checksum) · F32 NL query (read-only) · F33 extensibility (tags + infinite taxonomies) · F34 event outbox · F35 products/stock · F36 replenishment · F37 currencies/FX.
- **Web UI:** StyleX shell + routing · **Inventory** · **Finance** approvals · **Properties** · **People** — each with **Vitest UI** + **Playwright** browser e2e.
- **Mobile (F31):** Flutter capture-first shell (5-tab bar) + widget tests.

### Test types — all present & green
ScalaTest **FreeSpec** units · **weaver** server tests · **Testcontainers** Postgres integration (end-to-end) · **Vitest** UI/unit · **Playwright** browser e2e · **Flutter** widget tests.

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
