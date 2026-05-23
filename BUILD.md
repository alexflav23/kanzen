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

**Verified locally:** backend **`41/41`** (F00–F04, F08, F15, F17), web **Vitest `8/8`** + **Playwright `4/4`**.

### Features implemented so far (tested)
- **Backend:** **F00** foundation · **F01** identity · **F02** attribute-level RBAC · **F03** properties + nested location tree · **F04** asset registry core (categories tree, **JSONB attributes**, tracking modes, tags/collections) · **F08** lists (propose→approve) · **F15** bills + ±15% variance · **F17** expenses & approvals (per-jurisdiction threshold routing). **The M1 backend spine is complete.**
- **Web:** StyleX shell + grouped-nav routing, the **Inventory** feature (asset grid + category filter), and the **Finance** approvals queue (approve/reject) — each with Vitest UI tests + Playwright browser e2e.

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
