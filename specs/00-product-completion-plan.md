# Kanzen — Product Completion Plan

**Goal:** take Kanzen from the current state (tested backend domain modules + a design system + 5 mock-data web screens + a Flutter shell) to a **finished product**: every feature F00–F37 with **full web UI, full mobile functionality, wired end-to-end (UI → API → DB → integration), matching the `input/` design, and covered by the full test pyramid** (Scala FreeSpec units + weaver server + Testcontainers integration; web Vitest + Playwright; Flutter widget + integration).

> Status discipline (per `BUILD.md`): a feature is **Done** only when a real user can use it end-to-end against the real backend, it matches the design, and all its tests are green. "Code module exists with unit tests" is **not** Done.

---

## 0. Honest baseline (what we start from)

**Real & reusable**
- Design system + **theme engine** (StyleX `defineVars` → `createTheme` light/dark → `ThemeContext` ⌘D + persistence → **static CSS extraction**). ✅
- Backend **domain logic**: ~48 repo/service files (~37 feature areas), **126 tests** (FreeSpec + weaver + Testcontainers/Postgres 16) — *isolated*; the server only serves `/api/health` + `/docs`.
- Web: **5 of 17** screens built on **mock data** (Dashboard, Inventory, Finance, Properties, People) + 2 detail views.
- Mobile: 5-screen Flutter shell on mock data.

**Not started**: the API layer, auth, web↔backend wiring, real integrations, ~12 web screens, the real mobile app, and design-exact matching.

**Hard dependency:** obtain the **missing prototype source** (`input/` has only `views/*.jsx` + previews; we lack `styles.css`, `app.jsx`, `data.jsx`, `data-inventory.jsx`, `icons.jsx`). Needed for pixel-accurate design matching + a visual-diff harness. *Owner action.*

---

## 1. Definition of Done (every feature must pass ALL)

1. **Web UI** — every screen/state in the design for the feature (loading, empty, error, permission-filtered, edge cases), built with the StyleX design system, light + dark, responsive, a11y (axe) clean.
2. **Mobile** — the feature's mobile surface per the capture-first IA (or "not on mobile" explicitly, per design).
3. **API** — Tapir endpoint(s) wired into the server, OpenAPI documented, auth-secured, RBAC-enforced (resource + field level), audited where it writes.
4. **Wired** — web/mobile consume the real API (services + Zod on web; Dart client + models on mobile); no mock module remains for that feature.
5. **Integration** — any external dependency uses the real adapter (or a clearly-flagged sandbox) — see §6.
6. **Tests** — Scala FreeSpec unit + weaver server test + Testcontainers integration; web Vitest unit + Playwright e2e **against the real API**; Flutter widget (+ integration where stateful). Error/permission paths covered.
7. **Design match** — visually verified against the `input/` prototype (screenshot/▲golden diff), incl. dark mode.
8. **Invariants honoured** (§7).

---

## 2. Milestones

Sequenced by dependency. Each milestone ends at a **gate**: everything in it meets the §1 Definition of Done before the next begins. Sizing is relative (S/M/L/XL), not calendar dates.

### M0 — Spine / foundations (unblocks everything) — **XL**
Cross-cutting; must land first.

- **API platform** — Tapir endpoint module per domain; group + serve at `/api`; OpenAPI at `/docs`; shared error model (problem+json), pagination, validation; boot order wires Flyway → Doobie → endpoints (replace the health-only server). *(L)*
- **Auth (F01/F02)** — Cognito JWKS validation middleware → `Principal`; central `Authorizer` enforced on every endpoint (default-deny, resource/field none/read/write/admin + property scope); field-level response filtering. Web login + token storage/refresh; route guards. *(L)*
- **Web data layer** — `src/services/*` (hand-written) + **Zod** at boundaries + **TanStack Query** + **dinero.js**; standard loading/empty/error patterns; auth-aware fetch. Replace mock modules feature-by-feature. *(M)*
- **Component library (SPEC §16/App-E)** — finish: SegmentedControl, Tabs, FilterRail, MetaGrid, KvCard, Table, Timeline + EventDot, Modal, Toast, **CommandPalette (⌘K)**, EmptyState, AgentRibbon (have Card/Pill/Bar/icons). *(M)*
- **Shell chrome** — top bar (**⌘K** search, notifications, Quick-add), grouped nav with live badges/dots, breadcrumbs. *(M)*
- **Design source + visual harness** — import the missing prototype files; stand up a Playwright visual-diff (or golden) check vs the prototype. *(S, blocked on owner)*
- **Local real-data stack** — docker Postgres seeded with the **real** users (Toby/Lorna/Marcia/Siti) + properties (Wardian 5206; Singapore); web/mobile run against `:8080`. *(S)*
- **Mobile foundation** — Flutter architecture: routing, state mgmt, **Dart API client + models**, design-token/theme parity, capture-first IA (Home · Triage · Bibles · Money · Search). *(L)*

### M1 — Registry & Records — **XL**
Features: **F03** properties (+ bible), **F04** assets (JSONB) + detail, **F22** templates, **F23** completeness, **F19** lifecycle/events, **F20** valuation, **F21** warranty/insurance, **F24** restructure (split/group/structured sets), **F33** extensibility (tags + infinite taxonomies), **F10** people, **F09** vendors, **F05** documents (+ S3).
Web screens: Inventory (wire + grid/list/timeline), Asset detail (full), Collections, Property bible (all tabs incl. Rooms/Assets/Maintenance/Defects), People, Vendors, Vehicles, Documents.
Mobile: Bibles (property/asset browse), capture → asset.
Integration: **S3** (immutable originals).
Edge cases: grouped-quantity, structured sets, legacy/inherited assets, restructures, associated costs.

### M2 — Finance — **XL**
Features: **F12** bank ingestion, **F13** receipts + line items, **F14** reconciliation (+ transfer detection), **F15** bills (±15% variance), **F16** pay queue (**never moves money**), **F17** expenses/approvals (thresholds), **F18** ledger (double-entry), **F37** currencies/FX (txn-date rate), **F29** insights.
Web screens: Finance (4 tabs wired) + Payment methods + Budgets, Insights.
Mobile: Money (approvals, pay queue review, variance).
Integration: **GoCardless** (AIS, read-only), **TigerBeetle** (ledger postings, hidden in UI).
Edge cases: split receipts/transactions, partial payments, refunds, multi-currency reporting.

### M3 — Operations — **L**
Features: **F06** tasks (native, recurring), **F07** calendar, **F08** lists (propose→approve→roll-forward), **F36** replenishment, **F11** maintenance, **F35** products/stock ("in stock" + preferred vendors).
Web screens: Tasks, Calendar (month + agenda), Lists, Maintenance, Add-maintenance.
Mobile: lists/tasks quick actions.
Integration: **Google Calendar** (dedup), tasks are **native** (not an integration).
Edge cases: list approve → roll-forward cycle.

### M4 — Agent & Intelligence — **XL**
Features: **F25** email agent pipeline, **F26** unified inbox/triage, **F27** trust/rules (financial locked, propose-not-commit), **F28** search (full-text + filters), **F32** NL query (permission-filtered), **F34** event outbox.
Web screens: **Triage** (swipe/confirm agent proposals), **Inbox**, **⌘K Search/Command palette**, agent ribbons wherever the agent acted.
Mobile: **Triage** (the heart of the capture-first app: extracted KV + proposed actions + Reject/Confirm).
Integration: **Gmail** (ingest), **Bedrock** (Claude OCR + categorisation/pgvector), **Pulsar** (event backbone).
Invariant: financial/asset creation always **proposed**, never auto-commit.

### M5 — System & Settings — **L**
Features: **F30** backup/restore (catastrophic round-trip drill), Settings (incl. **RBAC permissions matrix** UI for F02), **F31** mobile completion.
Web screens: Backup, Settings/Permissions, account.
Mobile: full app parity for in-scope features + capture (camera/receipt), offline-capture queue.
Integration: **SES** (notifications), backup to S3.

### M6 — Hardening & launch readiness — **L**
- Cross-feature **edge-case suite** (split receipts, partial payments, refunds, grouped/structured assets, legacy assets, associated costs, restructures, list roll-forward, backup→restore round-trip).
- **Performance** (query/index review, web bundle, list virtualisation), **a11y** (axe across all screens), **visual regression** vs design (light + dark).
- **Security**: authz fuzzing (default-deny, field filtering, no leak via totals/search/NL), secrets in Secrets Manager.
- **Infra/CI** (Terraform: EC2+NixOS, ALB, RDS, S3, Cognito, CloudFront; GitLab CI on Nix; package → S3 → NixOS).
- Seed both real properties + real users end-to-end.

---

## 3. Testing strategy (the pyramid, per feature)

| Layer | Tool | Scope |
|---|---|---|
| Backend pure units | **ScalaTest FreeSpec** | domain rules (variance %, thresholds, FX, trust, completeness, reconciliation) |
| Backend service/HTTP | **weaver-cats** | endpoint behaviour incl. **authz/RBAC + field filtering** |
| Backend integration / e2e | **weaver + Testcontainers** Postgres 16 | repo round-trips, migrations, reconciliation, backup/restore |
| Web unit/UI | **Vitest + Testing Library** | components, services + **Zod** parsing, state |
| Web e2e | **Playwright** (Chromium) | full flows **against the real API**, light + dark, console-error guard, axe |
| Web visual | Playwright screenshot/golden | design-match vs `input/` |
| Mobile | **Flutter** widget + `integration_test` | screens + capture flows + app audit (exception guard) |

Cross-cutting: every PR runs all suites in CI; integration tests use a seeded ephemeral Postgres; auth/permission paths are tested negatively (forbidden, filtered).

---

## 4. Per-feature deliverable matrix (summary)

For **every** F-feature, the deliverable is: **[Web UI] + [Mobile surface or N/A] + [Tapir API] + [Integration or native] + [full test pyramid] + [design match]**. The milestone tables (§2) assign each feature; the detailed per-feature specs live in `specs/F__-*.md` and are the contract — each gains a "Productisation" section listing its exact screens, endpoints, and test cases.

---

## 5. Sequencing & dependencies

- **M0 is a hard prerequisite** for all feature milestones (no feature can be "wired" without the API + auth + web data layer).
- M1 (registry) and M2 (finance) can partially parallelise once M0 lands (different domains), but **F02 RBAC** and **F37 FX** are shared and land in M0/early-M1.
- M4 (agent) depends on M1–M3 data existing to act on.
- M6 hardening is continuous but gated last.
- **Vertical slice first:** within M0, prove the spine by wiring **one** feature (Inventory/F04) fully end-to-end before widening — de-risks the whole architecture.

---

## 6. Integrations & operator inputs (track in `SETUP.md`)

| Integration | Used by | Needed |
|---|---|---|
| **AWS Cognito** | F01/F02 auth | user pool, app client, JWKS URL |
| **GoCardless Bank Account Data** | F12 finance | API token, linked institutions (AMEX, Revolut, …) |
| **AWS Bedrock** | F25 OCR/categorisation | region/model access (Claude) |
| **Google** (Gmail/Calendar/Drive) | F07/F25 | OAuth client + mailbox/calendar IDs |
| **AWS S3** | F05 documents, F30 backup | bucket(s), eu-west-1 |
| **TigerBeetle** | F18 ledger | cluster (docker locally) |
| **Apache Pulsar** | F34 events | broker |
| **AWS SES** | notifications | verified sender/domain |
| Infra | M6 | Terraform state bucket, domains/DNS, CloudFront |

Each milestone names exactly which inputs it needs; missing inputs → that feature ships against a clearly-flagged sandbox/stub and is **not** marked Done.

---

## 7. Invariants (never violate — from `CLAUDE.md`)

- Kanzen **never moves money** (AIS read-only; "Mark paid" records reality; no PIS).
- Financial & asset creation is **always proposed**, never auto-committed (agent trust, F27).
- The **TigerBeetle ledger is hidden** in the UI (postings only; Postgres holds domain data).
- **Source documents are sacred** — immutable originals in S3; OCR is derived/versioned.
- **Everything is permission- and scope-filtered server-side** (incl. search, aggregates, NL — no leak via totals).
- Registry/finance is **Principal-private** with the documented Manager carve-out.

---

## 8. How we'll track it

- Each feature gets a **Productisation** checklist (the §1 DoD) appended to its `specs/F__-*.md`.
- `specs/00-master-implementation-plan.md` status column flips to **Done** only on full DoD.
- `BUILD.md` reports honest, end-to-end status (not module counts).
- One milestone in flight at a time; vertical-slice proof inside M0 before going wide.
