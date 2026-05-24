# Feature F00 — Foundation: infra, repo, design system

| | |
|---|---|
| **Feature ID** | F00 |
| **Milestone** | M0 |
| **Domain** | Platform |
| **Status** | ✅ spec complete |
| **Depends on** | — |
| **Spec references** | SPEC §14, §16, §17 (M0), Appendix E; mirrors `~/projects/hypervolt/{ghost-busters,athena,hyperstore}` |

> **Stack is locked here and inherited by every later feature.** Backend **Scala 2.13 + cats-effect 3 + http4s (ember) + Tapir + Circe + Doobie + Flyway**; **PostgreSQL 16** (double-entry general ledger — ADR-001); **S3**; **AWS Cognito** (deliberate divergence from Hypervolt's Keycloak); web **React 19 + Vite + StyleX**; mobile **Flutter**; **GitLab CI on Nix**; **Terraform** (EC2 autoscaling + NixOS) in **eu-west-1**; secrets in **Secrets Manager** + config in **SSM Parameter Store**; money via **dinero.js**. All choices mirror the existing Hypervolt repos except Cognito.

---

## 1. Purpose & user value
Stand up the monorepo, the deterministic local stack, CI/CD, AWS infra, and — critically — the **StyleX design-token set + component library** and the **app shells** (web + Flutter) so that every subsequent feature composes from a working, authenticated, observable, deployable skeleton. No end-user value ships in M0; its value is that M1+ can move fast and consistently. "Done" = a developer clones, runs one command, gets the full stack, and a deployable shell that authenticates and renders the navigation in light/dark.

## 2. Roles & permissions
No business permissions yet. F00 lays the **scaffolding** that F02 fills:
- A `RolePermission` (role × module × level) and `PropertyScope` table shape is created by migration but unpopulated (real seeding in F01/F02).
- The Tapir **security layer** (JWT/JWKS validation) is wired as middleware so endpoints can declare auth; F00 ships one authenticated smoke endpoint to prove the path.
- Roles enumerated for later use: `Principal`, `Manager`, `Staff`, `PropertyScopedManager` (SPEC §4).

## 3. Data model
F00 establishes the migration mechanism and a minimal baseline; domain tables belong to their features.

- **Migrations**: **Flyway**, files `src/main/resources/db/migration/V<major>_<minor>_<patch>__<description>.sql` (Hypervolt convention, e.g. `V1_0_0__baseline.sql`). `baselineOnMigrate = true`. Run on boot via a `FlywayInit.runFromUrl(databaseUrl)` step before the transactor is built (mirrors `ghost-busters/.../database/FlywayInit.scala`).
- **`V1_0_0__baseline.sql`**: enable extensions `pgcrypto` (UUIDs via `gen_random_uuid()`) and `citext`; set timezone `UTC`; create the cross-cutting **`audit_log_entries`** table (`id uuid pk`, `at timestamptz`, `actor_type` (`user`/`agent`/`system`), `actor_id`, `action`, `target_type`, `target_id`, `detail jsonb`, `owner_id`) — append-only, written by every feature.
- **`V1_0_1__authz_scaffold.sql`**: `role_permissions(id uuid, role text, module text, level text check in ('none','read','write','admin'))` and `property_scopes(id uuid, user_id uuid, property_id uuid)` — empty; populated by F02.
- **Type conventions** (inherited everywhere): PKs `uuid default gen_random_uuid()`; timestamps `timestamptz`; money stored as **integer minor units + ISO currency code** (never float); soft delete `deleted_at timestamptz null`; every domain table carries `owner_id uuid`. Doobie `Meta`/`Get`/`Put` instances for `uuid`, `Instant`, enums live in a shared `db` module.

## 4. API (Tapir endpoints)
The HTTP scaffolding (cats-effect `IOApp.Simple` → http4s `EmberServerBuilder`, CORS + Logger middleware, Tapir `Http4sServerInterpreter`):

- **Primary server `:8080`** (app port). Mounts Tapir routes under `/api`.
  - `GET /api/health` → `200 {status, version, gitSha}` (unauthenticated).
  - `GET /api/whoami` → authenticated smoke endpoint returning the decoded Cognito principal (proves the security layer).
- **Admin server `:9990`** (separate ember server, mirrors Hypervolt): `GET /health` for the ALB target-group health check.
- **Metrics `:9464`**: Prometheus scrape endpoint (`hv-telemetry` convention).
- **OpenAPI/Swagger**: `SwaggerInterpreter` serves the generated contract at `/docs` (env-specific `addServer`). The contract is documentation; clients are **hand-written** (web/Flutter), not generated.
- **Auth middleware**: a Tapir `EndpointInput.Auth` partial that validates a Cognito-issued JWT against the user-pool **JWKS** (cached), checks `iss`/`aud`/`exp`, and yields a `Principal(userId, identities, roles)`. Pattern mirrors `athena/.../api/auth/JwtConfig.scala` (JWKS host/subject/audience) but points at Cognito.

## 5. UI / screens & states
F00 delivers the **design system** and the **shells**, not features. The prototype (`input/`) is the visual source of truth; SPEC §16 + Appendix E define the system.

### Web (`/web` — Vite 8 + React 19 + TS strict + React Router 6 + StyleX)
- **Build**: `vite.config.ts` with the StyleX Babel transform in dev (`dev:true, runtimeInjection:true, genConditionalClasses:true, treeshakeCompensation:true`) before `@vitejs/plugin-react`, and `@stylexjs/rollup-plugin` for prod (extract to `assets/stylex.css`, Lightning CSS). Path aliases (`@components`, `@styles`, …) as in Hyperstore.
- **Design tokens** (`src/styles/tokens/*.stylex.ts` via `stylex.defineVars()`): port the prototype's CSS variables — ink scale (`ink`…`ink5`), warm surfaces (`bg`, `bgElev`, `bgSunken`, `bgOverlay`), lines (`line`, `lineStrong`), the single **accent** (+ `accentSoft`, `accentInk`), semantics (`positive`/`warn`/`danger` + soft), radii, shadows (`shadow1`, `shadow2`, `shadowPop`), motion easings, and the mono/numeric font tokens.
- **Themes** (`src/styles/themes/{light,dark}.stylex.ts` via `stylex.createTheme()`): warm-paper **light** (default) + **dark**; `ThemeContext` with `useTheme()`, **⌘D** toggle, `localStorage` persistence (mirrors Hyperstore's `ThemeContext.tsx`).
- **Component library** (`src/components/`): build the §16/App-E vocabulary as token-driven components — `Card`, `Pill` (outline/accent/positive/warn/danger), `SegmentedControl`, `Tabs` (+ count pill), `FilterRail` (collapsible groups, indented rows, chips), `MetaGrid` (`dl/dt/dd`), `KvCard`, `Table`, `Timeline` + `EventDot` (typed colour map), `Avatar`, `AgentRibbon`, `Bar`, `Modal` (+ stepper), `Toast`, `CommandPalette` (⌘K shell), `EmptyState`, plus icon set `I.*`.
- **App shell**: persistent **grouped left nav** (Dashboard · Inbox / INVENTORY / OPERATIONS / RECORDS / FINANCE & SYSTEM — SPEC §5), top bar (⌘K search, mobile-preview toggle, notifications bell), the 完 mark. Routes are stubs that render an `EmptyState` until their feature lands.
- **States**: light/dark; nav collapsed/expanded; loading/empty/error placeholders standardised.
- **Data layer**: `src/services/*` skeleton + **Zod** schemas at boundaries, **TanStack Query** provider, a typed `apiClient` wrapper (auth header, error mapping). **dinero.js** money helper. No business calls yet.

### Mobile (`/mobile` — Flutter)
- App skeleton with the **bottom tab bar** (Home · Triage · Bibles · Money · Search — App. E.18), theme parity (light/dark tokens mirrored), Cognito auth flow, an `ApiService` skeleton. Screens are placeholders.

## 6. Business rules & validation
- **Config** (`typesafe-config` + the Hypervolt `Stringy`/`Hardcoded[A]`/`Global[A]` wrappers + `ValidatedNel` accumulation): all env/config loaded at boot, **all missing keys reported at once** then fail fast (mirrors `athena/.../EnvironmentConfig.scala`). Keys: `PORT`, `ADMIN_PORT`, `METRICS_PORT`, `ENV`, `DATABASE_URL` (read + read-only), `S3_*`, `COGNITO_*` (pool id, region, jwks host, audience), `AWS_REGION=eu-west-1`.
- **Env detection**: `ENV ∈ {local, staging, prod}`; `Hardcoded` values resolve per env.
- **Boot order**: load+validate config → Flyway migrate → build Doobie `HikariTransactor` (Resource) → http client → S3 client → start admin server (`:9990`) → start metrics (`:9464`) → start primary server (`:8080`) → `IO.never`.
- **Money**: integer minor units + currency code end-to-end; no float arithmetic (web uses dinero.js).

## 7. Integrations / external systems (skeleton adapters, each behind an interface)
- **PostgreSQL 16** — Doobie + Hikari; local via docker-compose.
- **General ledger** — Postgres double-entry (ADR-001); F18 builds the engine. *(TigerBeetle dropped — not an exchange.)*
- **S3** — `ObjectStore` interface (put/get/presign); local via **LocalStack**; bucket naming `kanzen.{env}.eu-west-1.hypervolt` (app) and `kanzen-docs.{env}.eu-west-1.hypervolt` (documents).
- **AWS Cognito** — user pool (Terraform) with **enforced MFA**; JWKS validation middleware. **Local dev**: a dev-mode token issuer/verifier (configurable) so local doesn't depend on a real pool — see Open Questions.
- **AWS SES**, **Bedrock** — interface stubs only (wired in F25/notifications).
- **Secrets/config** — Secrets Manager (DB creds, app secrets) + SSM Parameter Store (`/{env}/kanzen/*`), surfaced as env on the NixOS host.

### Repo, dev env, CI/CD, IaC
- **Monorepo** `/backend` (sbt: start single module, ready to split into `domain`/`api`/`consumer`), `/web`, `/mobile`, `/docs`, `/specs`, `/terraform`, plus `docker-compose.yml`, `Dockerfile` (local), `.gitlab-ci.yml`, `shell.nix` + `npins/`, `.envrc`.
- **Dev env**: **Nix + npins + direnv** pinning Temurin JDK 17, sbt, Node 20, Terraform, awscli, Flutter. `docker-compose up` → Postgres 16 + LocalStack.
- **Build/package**: sbt with `sbt-assembly`, `sbt-native-packager` (`Universal/packageXzTarball` → `.txz`), `sbt-scalafmt`, `flyway-sbt`, `sbt-git`. `scalafmt` enforced.
- **CI** (`.gitlab-ci.yml` on `nixos/nix` images): `terraform-lint` (fmt) · `compile-backend` (`sbt compile`) · `test-backend` (`sbt test`) · `package-backend` (`Universal/packageXzTarball`, main only) · `publish` (`./scripts/publish $CI_COMMIT_SHORT_SHA` → `pkgs` S3) · `web-build`/`web-test` (Vitest) · `deploy-frontend` (S3 sync + CloudFront invalidate; staging auto, prod manual gate).
- **IaC** (`/terraform/kanzen/`): S3 state (`eu-west-1.tf.hypervolt`, key `kanzen/terraform.tfstate`), workspaces `staging`/`prod`, AWS provider **eu-west-1** (+ us-east-1 alias for ACM). Resources: `ec2-autoscaling-group` + `nixos-bootstrap` modules (target group `:8080`, health `:9990`), shared `infrastructure-lb`, **RDS Postgres 16** (`terraform-aws-modules/rds`, multi-AZ prod), **S3** buckets, **Cognito user pool** (MFA required), Secrets Manager + SSM, IAM roles, Route53 private zone + ACM + **CloudFront/S3** for the web app, Prometheus `:9464`.

## 8. Edge cases
- Missing/invalid config → fail boot with the **full list** of missing keys (not the first).
- Flyway migration failure → abort boot, non-zero exit, logged with version.
- DB unavailable at boot → bounded retry then fail (ALB keeps instance out via `:9990`).
- JWKS endpoint down → auth middleware serves cached keys; on cold cache, 503 on authed routes, health stays green.
- S3 down at boot → log + degrade (don't crash the API for skeleton phase); surface in `/health` detail.
- Dark/light flash on first paint → theme resolved from `localStorage` before first render.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Local stack boots clean**  ‹maps: `FoundationBootIT`, backend `HealthSpec`›
- **Given** a freshly cloned repo
- **When** a developer runs `direnv allow && docker-compose up && sbt run`
- **Then** Flyway migrations apply without error, `GET :9990/health` returns 200, `GET :8080/api/health` returns `{status, version, gitSha}`, `/docs` serves the OpenAPI contract, and `:9464` exposes Prometheus metrics
- **And** the boot log records all config keys resolved; no key is missing.

**AC2 — Auth middleware: valid and invalid tokens**  ‹maps: `JwtMiddlewareSpec`, web `auth.spec`›
- **Given** the backend is running with the dev-mode JWT issuer
- **When** Toby calls `GET /api/whoami` with a valid dev-mode token
- **Then** the response contains his decoded Cognito principal (userId, role, scope)
- **And** calls with no token, an expired token, or a wrong-audience token receive **401** — the request is rejected before reaching any handler.

**AC3 — Config fails fast with all missing keys**  ‹maps: `ConfigLoadSpec`›
- **Given** the application is started with several required env vars unset (`DATABASE_URL`, `COGNITO_POOL_ID`, `S3_BUCKET`)
- **When** the process boots
- **Then** it **exits non-zero** and the log lists **every** missing key in a single error, not just the first
- **And** no partial initialisation (no migration, no server port bound).

**AC4 — Web shell: design system & light/dark**  ‹maps: web `shell.spec` (Playwright), `ThemeContext.test` (Vitest)›
- **Given** `npm run dev` on the web project
- **When** Toby loads the app
- **Then** the grouped left nav (Dashboard · Inbox / INVENTORY / OPERATIONS / RECORDS / FINANCE & SYSTEM), the top bar with the 完 mark, and the ⌘K command-palette trigger all render in warm-paper light
- **And** pressing **⌘D** toggles to dark with no flash (theme resolved from `localStorage` before first paint); every stub route shows a styled `EmptyState`; the `/dev/components` gallery renders every library component.

**AC5 — Money renders correctly via dinero.js (negative: no floats)**  ‹maps: `MoneyHelperSpec` (Vitest)›
- **Given** a money value stored as integer minor units (e.g. `125050` GBP pence, `980000` SGD cents)
- **When** a component renders it using the dinero.js helper
- **Then** it displays as `£1,250.50` and `S$9,800.00` with tabular figures
- **And** no floating-point arithmetic is performed at any layer — the helper test asserts integer-only operations.

**AC6 — Flutter shell builds with light/dark and tab bar**  ‹maps: `flutter test` widget test `shell_test.dart`›
- **Given** `flutter run` on the mobile project
- **When** the app launches
- **Then** the 5-tab bar (Home · Triage · Bibles · Money · Search) renders in both light and dark themes; each tab shows a placeholder screen; the Cognito auth flow screen is reachable.

**AC7 — CI pipeline is green**  ‹maps: `.gitlab-ci.yml` pipeline jobs›
- **Given** a commit to the main branch
- **When** the GitLab CI pipeline runs
- **Then** `terraform-lint`, `compile-backend`, `test-backend`, `web-build`, and `web-test` all pass; `Universal/packageXzTarball` produces an artifact; `terraform plan` for the `staging` workspace exits 0.

## 10. Test plan
- **Backend**: weaver-cats + **testcontainers-postgresql** — boot test (migrations run clean against a fresh PG16), `/api/health` + `:9990/health` tests, config-loading test (asserts all-missing-keys accumulation), auth-middleware test (valid/expired/wrong-aud JWT against a test JWKS), a sample Tapir endpoint round-trip (Circe encode/decode).
- **Web**: Vitest unit tests for a token-driven component + `ThemeContext` toggle/persistence; Playwright smoke (shell renders, theme toggles, nav routes reachable) + `@axe-core/playwright` a11y on the shell.
- **Infra**: `terraform validate` + `fmt -check` in CI.

## 11. Observability & audit
- **Logging**: log4cats + logback, structured, request/response via http4s `Logger` middleware.
- **Metrics**: Prometheus on `:9464` (`hv-telemetry` scrape source); OpenTelemetry initialised at startup.
- **Health**: `:9990/health` (ALB) + `/api/health` (detail incl. DB/S3 reachability).
- **Audit**: `audit_log_entries` table created; an `AuditWriter` service exists so every later feature writes through one path. F00 logs `system` boot/migration events.
- **Web**: Sentry + a `loggerService` skeleton (mirrors Hyperstore).

## 12. Open questions / decisions
1. **Cognito local dev** — LocalStack Cognito (limited) vs a shared real `dev` user pool vs a dev-mode JWT issuer behind a flag. *(Lean: dev-mode issuer locally; real pool in staging/prod.)*
2. ~~TigerBeetle provisioning~~ — **resolved (ADR-001): dropped; the general ledger is Postgres double-entry.**
3. **Backend module split timing** — single sbt module to start vs split `domain`/`api`/`consumer` at M0. *(Lean: single now, split when the agent/consumer arrives at M6.)*
4. **i18n** — Hyperstore uses i18next/28 locales; Kanzen is a single private household. Skip i18n (English-only) for v1? *(Lean: yes, skip.)*
5. **Flutter CI** — same GitLab pipeline vs a separate mobile pipeline; codemagic vs GitLab runners for iOS builds.
