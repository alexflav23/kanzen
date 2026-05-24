# CLAUDE.md — Kanzen build conventions & house style

Guidance for Claude Code (and humans) building **Kanzen**, the household operations & asset-registry platform. Conventions mirror existing Hypervolt repos (`ghost-busters`, `athena`, `hyperstore`); Cognito is the one deliberate divergence (they use Keycloak).

## Canonical docs (read these first)
- **`Kanzen-Platform-Spec.md`** — the *what/why* (v6, reconciled with the design prototype + Hypervolt stack). Keep current; this is `SPEC.md`.
- **`specs/00-master-implementation-plan.md`** — **the single source of truth**: the 44-feature plan (F00–F43), waves/sequence, Definition of Done, slice playbook, decisions, dependency graph + status tracker. (The former `00-product-completion-plan.md` is merged into it.)
- **`specs/F__-*.md`** — implementation-ready spec per feature (data model, Tapir API, UI states, edge cases, acceptance, tests).
- **`specs/01-data-model.md`** — consolidated schema + migration order.
- **`SETUP.md`** — every operator-provided input (AWS, tokens, DNS, accounts). Keep current.
- **`input/`** — the React/StyleX design prototype = the **canonical visual reference**.

## Stack (locked)
- **Backend**: Scala **2.13** · **cats-effect 3** (`IOApp.Simple`, `Resource`) · **http4s** ember · **Tapir** (+ Swagger/OpenAPI) · **Circe** · **Doobie** (HikariTransactor) · **Flyway** · **PostgreSQL 16 + pgvector** (double-entry general ledger — `specs/02-accounting-ledger-architecture.md`, ADR-001) · typesafe-config (`Stringy`/`Hardcoded`/`Global` + `ValidatedNel`) · log4cats+logback · OpenTelemetry/Prometheus.
- **Auth**: **AWS Cognito** (JWKS validation middleware) — *not* Keycloak.
- **Web**: React 19 · **Vite** · **StyleX** (`defineVars` tokens + `createTheme` themes + `ThemeContext`) · TanStack Query · **hand-written services + Zod** (no generated client) · dinero.js (money) · Vitest + Playwright.
- **Mobile**: Flutter (capture-first companion).
- **Infra**: AWS **eu-west-1** · **Terraform** (EC2 autoscaling + **NixOS**, shared ALB, RDS, S3, Cognito, CloudFront) · **GitLab CI on Nix** · packaged as `Universal/packageXzTarball` → S3 `pkgs` → NixOS pull · Secrets Manager (secrets) + SSM (config).
- **Dev**: Nix + npins + direnv · `docker-compose` (Postgres 16, LocalStack).

## Repo layout (monorepo)
```
/backend   sbt (start single module; split domain/api/consumer when the agent lands)
/web       Vite + React + StyleX
/mobile    Flutter
/specs     feature specs + master plan + data model
/terraform per-service modules (state in s3, workspaces=env)
/docs
SPEC.md  CLAUDE.md  SETUP.md  docker-compose.yml  shell.nix  .gitlab-ci.yml  .envrc
```

## Backend conventions
- **Boot order** (mirror athena): load+validate config (report *all* missing keys) → Flyway migrate → Doobie transactor (Resource) → http client → S3 → admin server `:9990 /health` → metrics `:9464` → primary `:8080` (`/api`) → `IO.never`.
- **Endpoints**: define with Tapir, group by domain, serve OpenAPI at `/docs`. **Auth** = Tapir security partial validating the Cognito JWT (cached JWKS) → `Principal`.
- **AuthZ once, centrally**: a shared `Authorizer` (resource/field level none/read/write/admin + property scope, F02); **agent actions take the same path**; **default deny**; **field-level response filtering** (e.g. strip valuations for Manager).
- **DB**: PKs `uuid default gen_random_uuid()`; timestamps `timestamptz`; **money = integer minor units + ISO currency** (never float); **`owner_id` on every domain row**; **soft delete** `deleted_at`; Doobie `sql"…"` + `Meta` instances in a shared `db` module.
- **Migrations**: Flyway `V<maj>_<min>_<patch>__desc.sql` in `resources/db/migration`, in the order in `specs/01-data-model.md`. `baselineOnMigrate=true`.
- **Audit**: every meaningful write → `audit_log_entries` via one `AuditWriter`; corrections are events, never mutations; immutable originals + ledger postings.
- **Config/secrets**: typed wrappers + `ValidatedNel`; secrets from Secrets Manager, config from SSM; nothing secret in git.
- **Testing**: **weaver-cats + testcontainers-postgresql** (athena pattern); extra rigor for **reconciliation** and **backup/restore**.
- **Integrations** (Gmail, Calendar, GoCardless, Bedrock, Cognito, SES, S3) = isolated adapters behind internal interfaces; **tasks are native, not an integration**.

## Frontend conventions (mirror hyperstore)
- Vite + StyleX: Babel transform (dev) before the React plugin; `@stylexjs/rollup-plugin` (build). Path aliases (`@components`, `@styles`, …).
- **Design tokens** (`src/styles/tokens/*.stylex.ts` via `defineVars`) + **themes** (`src/styles/themes/{light,dark}.stylex.ts` via `createTheme`) + `ThemeContext` (⌘D, localStorage) — port the prototype's variables.
- Build the §16/App-E **component library** first (Card, Pill, SegmentedControl, Tabs, FilterRail, MetaGrid, KvCard, Table, Timeline+EventDot, AgentRibbon, Bar, Modal, Toast, CommandPalette, EmptyState).
- **Data layer**: `src/services/*` + **Zod at boundaries** + TanStack Query; **dinero.js** for money. No OpenAPI-generated client.
- Tests: Vitest (unit) + Playwright (e2e) + axe (a11y).

## Design language (SPEC §16, App. E; prototype in `input/`)
Warm-paper light + dark (⌘D), single indigo accent, 完 mark, tabular money, grouped left nav + ⌘K top bar, agent ribbon wherever the agent acted, restrained motion, calm/butler tone. Apple-grade restraint.

## House rules (invariants — never violate)
- **Kanzen never moves money** (AIS read-only; "Mark paid" records reality; no PIS).
- **Financial & asset creation never auto-commit** — always proposed (agent trust, F27).
- **The general ledger is hidden in the UI** — statements/registers only; raw postings never shown. The books are Postgres double-entry (ADR-001).
- **Source documents are sacred** — immutable originals in S3; OCR is derived/versioned; the agent files to S3, never Drive.
- **Everything is permission- and scope-filtered server-side** — including search, aggregates and NL queries (no leak via totals).
- **Registry/finance is Principal-private** with the documented Manager operational carve-out.

## How to build
- **Milestone by milestone, spec-driven.** Stand up F00 (incl. the StyleX design system) first; build the M1 spine before going wide. Each feature spec is the contract; update its status in the master plan and keep `SETUP.md` current as integrations land.
- Define the schema + OpenAPI contract early (the domain model + `specs/01-data-model.md` are the spine).
- Seed the two real properties (Wardian Apt 5206; Singapore) and the real users (Toby, Lorna, Marcia, Siti).
- Implement the hard edge cases on purpose: split receipts/transactions, partial payments, refunds, grouped/structured assets, legacy assets, associated costs, restructures, the list approve→roll-forward cycle, and the catastrophic backup→restore round-trip.

## Common commands (fill in exact targets during F00)
```
direnv allow && docker-compose up          # local stack (PG16, LocalStack)
cd backend && sbt run                       # backend (:8080 api, :9990 health, :9464 metrics)
cd backend && sbt scalafmtAll test          # format + test (weaver + testcontainers)
cd web && npm run dev | build | test        # Vite + StyleX web
cd mobile && flutter run                     # Flutter companion
cd terraform/kanzen && terraform workspace select staging && terraform plan
```
