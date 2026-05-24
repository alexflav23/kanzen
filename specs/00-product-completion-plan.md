# Kanzen — Product Completion Plan (v2)

**Goal:** every feature F00–F37 → **full web UI + full mobile + wired end-to-end (UI → API → DB → integration) + full test pyramid + design-matched**, shipped as a usable product.

**v2 change vs v1:** the unit of work is now a **repeatable vertical slice**, not a giant per-domain "milestone". We ship a thin end-to-end thread first (walking skeleton), then deliver features one slice at a time in dependency order, pulling shared pieces in just-in-time. CI + deploy + auth are sequenced sanely (early, not at the end).

> **Done bar:** a real user can use the feature end-to-end against the real backend, it matches the design, and all its tests are green. "Tested module exists" ≠ Done.

---

## A. Decisions baked in (override any)

- **D1 — Auth (your call): real Cognito from the start.** Phase 0 builds the real **JWKS-validation middleware → `Principal` → default-deny `Authorizer`** and real **web login** (Cognito Hosted UI / OIDC). **→ Critical-path operator input:** a Cognito **dev user pool** (app client + JWKS URL) is needed before Phase 1 can fully complete — now the **first `SETUP.md` item**. **Testability:** CI / integration / Playwright authenticate against a **local test issuer (RSA keypair → test JWKS)** the *same* middleware validates, plus a Cognito test user via `USER_PASSWORD_AUTH` for the real-login e2e — so tests never depend on a live browser SSO dance.
- **D2 — "Deployable":** the skeleton is "deployable" = **builds + runs against dockerised Postgres locally + CI green**. Real AWS deploy (Terraform/NixOS/Cognito/CloudFront) is the **final wave** (needs operator accounts). We prove the thread locally first.
- **D3 — Design source:** match from `input/views/*.jsx` + `previews/` (the actual component source — faithful). The missing `styles.css`/`app.jsx`/`data*.jsx`/`icons.jsx` are a *nice-to-have* for pixel-diffing, **not a blocker**. Visual-diff harness uses our own approved screenshots as goldens.
- **D4 — Integrations:** each integration ships against its **sandbox** first (GoCardless sandbox, Cognito dev pool, Bedrock dev, Gmail test mailbox), explicitly flagged. A feature on a sandboxed integration is **"Done (sandbox)"** — distinct from **"Done (prod)"**, which requires the real account (swapped at the final wave).
- **D5 — Money:** integer minor units everywhere; **dinero.js** on web; **FX (F37) lands before** any multi-currency reporting.
- **D6 — Tracking:** master-plan status per feature = `Backlog → In-slice → Done (sandbox) → Done (prod)`. Each `specs/F__-*.md` gets a **Productisation** section (screens, endpoints, states, edge cases, test list) = the slice's contract.

---

## B. The Vertical-Slice Playbook (every feature follows this)

The unit of delivery. Mechanical and trackable:

1. **Spec** — read `specs/F__-*.md`; write its **Productisation** section (screens + states, endpoints, edge cases, test list).
2. **DB** — migration(s) + seed if needed.
3. **API** — Tapir endpoint(s) + Doobie repo wiring + **Authorizer rule (default-deny)** + **audit** on writes + OpenAPI entry.
4. **Backend tests** — FreeSpec (domain rules) + weaver (endpoint **incl. authz/field-filter**) + Testcontainers (repo round-trip).
5. **Web service** — Zod schema + service + TanStack Query hook; **delete the feature's mock module**.
6. **Web UI** — screen(s) + every state (loading / empty / error / **forbidden**), light + dark, **design-matched**, a11y (axe).
7. **Web tests** — Vitest (component/service) + Playwright (flow **against the real API**, console-error guard, axe).
8. **Mobile** — screen/surface + Dart model/client + widget test (or "N/A on mobile" per design).
9. **Verify** — visual diff vs prototype; run the DoD checklist; flip status.

**Slice sizes:** S (≤ a day-ish of focused work), M, L — relative, not calendar. Counts below, not dates.

---

## C. Phase 0 — Pre-flight (one-time; makes slices possible)

No features yet — this builds the rails the playbook runs on.

- **Backend API scaffold** — replace the health-only server with: router under `/api`, shared error model (problem+json), pagination/validation conventions, **real Cognito JWKS-validation middleware → `Principal`** (validated in tests against a local test JWKS), the **`Authorizer` enforced by default-deny**, OpenAPI at `/docs`. *(L)*
- **Web data-layer scaffold** — TanStack Query client, Zod conventions, **auth context wired to Cognito login (OIDC/Hosted UI) + token storage/refresh + fetch wrapper**, and reusable **loading / empty / error / forbidden** primitives. *(M)*
- **Operator input (now critical-path): Cognito dev pool** — user pool, app client, JWKS URL, a test user. Without it, the middleware + login are *built and unit-tested* (test JWKS) but the real-login e2e and Phase 1 gate can't complete. *(blocked on owner)*
- **CI pipeline** — runs all suites on every push: backend (sbt test), web (Vitest + Playwright against a built+served app or dev server), Flutter (`flutter test`). Green-gate. *(M)*
- **Local real-data stack** — docker Postgres seeded with the **real** users (Toby/Lorna/Marcia/Siti) + properties (Wardian 5206; Singapore); one-command up. *(S)*
- **Mobile foundation** — Flutter routing + state + **Dart API client + models** + theme/token parity + capture-first IA (Home · Triage · Bibles · Money · Search). *(L)*
- **Visual-diff harness** — Playwright screenshot baseline per screen (light + dark) to guard design match. *(S)*

**Gate:** rails exist, CI green, app runs against real Postgres locally — but no feature is wired yet.

---

## D. Phase 1 — Walking skeleton (thinnest end-to-end thread)

One feature, all layers, to prove the architecture **before** going wide. Chosen feature: **F03 Properties (read path)** — smallest real domain, screen already built, seeds the two real properties.

Thread: **Cognito login → `GET /api/me` → `GET /api/properties` (Authorizer-filtered, from Postgres) → Properties page renders real data → Playwright e2e (test-JWKS auth) → CI green → runs in docker.**

**Gate (demoable):** a real user logs in **via Cognito**, sees the two seeded properties **from the database** (not mock), light + dark, fully tested and green in CI. This is the proof the whole stack connects; every later slice repeats the playbook on top of it.

---

## E. Phase 2 — Feature waves (dependency-ordered backlog of slices)

Each item = one vertical slice (Playbook §B). Grouped into waves for ordering and demoable gates; shared components pulled **just-in-time** (§F). `→` = "before".

- **Wave A — Access control** *(F01 identity/Cognito is delivered in Phase 0/1)*
  `F02` RBAC depth: Authorizer **field-level filtering** + **Settings → permission-matrix UI** + user/role management. **Gate:** a Manager sees service info but not valuations; no leak via any read.
- **Wave B — Registry & records** *(the asset bible)*
  `F03` full bible (Rooms/Assets/Maintenance/Defects/Docs tabs) → `F04` assets + detail (JSONB) → `F22` templates → `F33` tags/taxonomies → `F23` completeness → `F19` lifecycle/events → `F20` valuation → `F21` warranty/insurance → `F24` restructure (split/group/sets); records: `F10` people, `F09` vendors, `F05` documents (**S3**). **Gate:** browse the real registry; open an asset's life history.
- **Wave C — Finance** *(money in, never out)*
  `F37` FX (first) → `F12` bank ingest (**GoCardless** sandbox) → `F13` receipts → `F14` reconciliation → `F15` bills → `F16` pay queue → `F17` expenses/approvals → `F18` ledger (**TigerBeetle**, hidden in UI) → `F29` insights. **Gate:** real bank txns reconcile; approve an expense; multi-currency totals.
- **Wave D — Operations**
  `F06` tasks (native) → `F07` calendar (**Google**) → `F08` lists → `F36` replenishment → `F35` products/stock → `F11` maintenance. **Gate:** a list rolls forward; a maintenance plan schedules.
- **Wave E — Agent & intelligence**
  `F34` events (**Pulsar**) → `F25` agent (**Gmail** + **Bedrock** OCR) → `F26` inbox/triage → `F27` trust → `F28` search (+ **⌘K**) → `F32` NL query. **Gate:** an inbound email becomes a *proposed* (never auto) action you confirm in Triage.
- **Wave F — System & mobile**
  `F30` backup/restore → Settings polish → `F31` mobile full (capture/camera, offline queue). **Gate:** catastrophic backup→restore round-trip; capture a receipt on mobile.
- **Final wave — Hardening & launch**
  edge-case suite (split receipts, partial payments, refunds, grouped/structured/legacy assets, associated costs, restructures, list roll-forward) · perf · a11y sweep · visual regression · **authz fuzzing** (no leak via totals/search/NL) · **real AWS infra** (Terraform/NixOS/Cognito/CloudFront, secrets) · prod-credential swap → **Done (prod)**.

---

## F. Shared components pulled just-in-time (first feature that needs them)

| Component | First needed by |
|---|---|
| Table | F03 bible / F04 list / Finance |
| FilterRail | F04 Inventory |
| Tabs / SegmentedControl | Property bible, Finance |
| MetaGrid / KvCard | asset & property detail, Triage |
| Timeline + EventDot | F19 lifecycle |
| Modal / Toast | first write (F03/F04 create/edit) |
| **CommandPalette (⌘K)** + top-bar search | F28 search (or earlier if useful) |
| Notifications / Quick-add (shell chrome) | Wave D/E |

Build each when its first consumer slice reaches it — not up front.

---

## G. Testing strategy (per slice; unchanged from v1)

ScalaTest **FreeSpec** (rules) · **weaver** (endpoint + **authz/field-filter**) · **Testcontainers** Postgres (round-trip, migrations, reconciliation, backup/restore) · **Vitest** (component/service+Zod) · **Playwright** (flows **against real API**, console-error guard, axe, visual diff) · **Flutter** widget + `integration_test`. All run in CI on every push.

---

## H. Integrations & operator inputs (`SETUP.md`)

**Cognito (Phase 0/1 — CRITICAL PATH, needed first)** · GoCardless (F12) · Bedrock (F25) · Google Gmail/Calendar/Drive (F07/F25) · S3 (F05/F30) · TigerBeetle (F18) · Pulsar (F34) · SES (notifications) · Terraform/DNS/CloudFront (final wave). Each wave names exactly what it needs; missing input → **Done (sandbox)**, not **Done (prod)**.

---

## I. Invariants (never violate — `CLAUDE.md`)

Never moves money (AIS read-only; "Mark paid" records reality) · financial/asset creation **always proposed** (F27) · **ledger hidden** in UI · **source docs sacred** (immutable S3 originals) · **everything permission/scope-filtered server-side** (incl. search/aggregates/NL — no leak via totals) · registry/finance **Principal-private** (Manager carve-out).

---

## J. Risk register (top)

| Risk | Mitigation |
|---|---|
| Architecture wrong (layers don't fit) | **Walking skeleton (Phase 1) proves it before any breadth** |
| Auth blocks everything | D1 dev-login first; Cognito as a swap slice |
| Integration setup latency (GoCardless/Bedrock/Google) | D4 sandbox-first, prod swap at the end; never blocks feature UI/logic |
| Design drift from prototype | D3 match from views/previews + visual-diff goldens per screen |
| RBAC leak via totals/search/NL | authz fuzzing in final wave + field-filter tests per slice |
| Scope/morale (it's big) | demoable gate per wave; one slice in flight; honest status |
| Missing prototype files | proceed from views/previews; request files as enhancement |

---

## K. Rough size

~38 feature slices + Phase 0 (6 foundation tasks) + final hardening wave. Mix of S/M/L; finance (Wave C) and agent (Wave E) are the heaviest. This is a **large multi-month build** — tracked by slices completed, not by a fabricated date.

---

## L. How we track

`specs/00-master-implementation-plan.md` status column (D6 states) · per-spec **Productisation** checklist · `BUILD.md` reports honest end-to-end status · one slice in flight; wave gate before the next.

---

## M. Immediate execution backlog — start here (Phase 0 + Phase 1, ordered)

Each task has a crisp acceptance check. Do them in order; ★ = can proceed without the Cognito pool (uses the test JWKS), ⛔ = needs the Cognito dev pool.

**Phase 0 — rails**
- **0.1 ★ Backend API scaffold** — `/api` router, problem+json error model, pagination/validation, OpenAPI at `/docs`; keep `/health`. *Acc:* a trivial `/api/ping` returns through the new stack; `/docs` lists it; existing tests still green.
- **0.2 ★ Auth middleware** — Tapir security: Cognito **JWKS RS256 validation → `Principal`**; cached JWKS; `Authorizer` (resource/field none/read/write/admin + property scope), **default-deny**. Tests use a local RSA test issuer. *Acc:* weaver test — valid test-JWT passes, missing/invalid/forbidden → 401/403; default-deny proven.
- **0.3 ⛔→★ Web auth + data layer** — Cognito OIDC login (Hosted UI) + token storage/refresh; TanStack Query client; Zod conventions; fetch wrapper attaching the token; loading/empty/error/forbidden primitives. *Acc:* unauthenticated → login; authenticated fetch carries the bearer; primitives unit-tested. (Login UI built ★; real round-trip ⛔ needs pool.)
- **0.4 ★ CI pipeline** — one pipeline runs backend (`sbt test`), web (`vitest` + `playwright`), mobile (`flutter test`) on push; green-gate. *Acc:* a red test fails the pipeline; all-green passes.
- **0.5 ★ Local real-data stack** — boot order wired (config → Flyway migrate → Doobie → endpoints); docker Postgres seeded with real users + 2 properties; one-command up. *Acc:* `docker compose up` + `sbt run` serves `/api` against seeded Postgres.
- **0.6 ★ Mobile foundation** — Flutter routing/state + Dart API client + models + theme parity + capture-first IA shell. *Acc:* app boots to Home; client can call `/api/ping`; widget test green.
- **0.7 ★ Visual-diff harness** — Playwright screenshot baselines (light + dark) for existing screens. *Acc:* a deliberate visual change fails the diff.

**Phase 1 — walking skeleton (F03 Properties, read)**
- **1.1 ★ DB** — confirm/align `properties` table + seed the two real properties. *Acc:* row round-trip via Doobie.
- **1.2 ★ API** — `GET /api/me` (`Principal`) + `GET /api/properties` (Authorizer-filtered) on real repo. *Acc:* weaver — returns only properties the principal may see; OpenAPI documents both.
- **1.3 ★ Backend tests** — FreeSpec (filter logic) + weaver (authz) + Testcontainers (repo). *Acc:* all green incl. a negative-authz case.
- **1.4 ⛔→★ Web wire** — properties service + Zod + query hook; Properties page renders **real** data (delete its mock); behind the login gate. *Acc:* page shows the 2 DB properties, light + dark; mock module gone.
- **1.5 ★ Web e2e** — Playwright (test-JWKS auth) login → properties from the real API; Vitest service test. *Acc:* green in CI.
- **1.6 ⛔ Real-login e2e** — one Playwright run against the Cognito dev pool (test user, `USER_PASSWORD_AUTH`). *Acc:* real token validates end-to-end.
- **1.7 Gate** — demo + DoD review; flip F03(read) status; record what's `Done (sandbox)` vs `Done (prod)`.

**Critical-path note:** everything ★ proceeds now. The ⛔ items (real web login round-trip, real-login e2e) need the **Cognito dev pool** — first `SETUP.md` ask. Until it lands, those run on the test JWKS and Phase 1's *real-login* gate stays open while all other work continues.

---

## N. Marvis integration (automated expense engine)

Source: `gitlab.com/outworkers/marvis` — a UK automated expense + tax system (Scala/Cassandra/Joda-Money). Its **domain logic is ported onto Kanzen's stack** (Postgres/Doobie, integer minor units, cats-effect/Tapil) — not lifted as code. Folds into the **Finance domain (Wave C)**; Principal-private (F02).

| Marvis capability | Kanzen | Action |
|---|---|---|
| CSV / Google-sheet statement import (`importer`, `data/*.csv`) | **F12** | extend: import path beside GoCardless + column mapping |
| Duplicate detection (amount/time tolerance) | F12 / **F14** | extend: dedup on ingest/reconcile |
| FX normalization — `TransactionNormalizer`/`ExchangeRate`, `sourceCurrency` + `initialAmount` per txn | **F37** | reuse logic: store original ccy+amount, normalize at txn-date rate |
| Receipt = grouped line items (per-item tax%, VAT, manufacturer, qty, unit price) + receipt aggregates (paid / tax-deductible / VAT-deductible) | **F13** | extend: line VAT/deductible + manufacturer + aggregates |
| Expense: tax%, expensed/deductible flag, income-vs-expense, status/type, filters/lists | **F17** (+ F33 tags) | extend |
| Stats aggregates + time-framed reports | **F29** | extend |
| Exports (StoredFile / ExportStore) | **F30** | extend |
| **UK tax engine** — income/dividend/salary tax, National Insurance, corporation tax, personal allowance, tax bands, VAT deductibility, TaxProfile | — | **NEW → F38 Tax, VAT & deductibility** |

**Net plan change:** +1 feature (**F38**, Wave C) + scope extensions to F12/F13/F14/F17/F29/F30/F37. marvis serves as the porting reference for tax bands, FX normalization, CSV parsing, receipt itemization and duplicate detection.

### N.1 Coverage audit vs full marvis surface
Compared against marvis's complete API surface (Expense · Income · Receipt · Import · Reports · Stats · Tags · Export · Users) + FX source/cache + S3 + Mailer. **All covered** by the mapping above, with two refinements added:
- **Income first-class & categorized** → extend **F17/F12**: income credits get an income flag **and a category** (salary / dividend / rental / interest / other) + (optional) recurring income, so **F29** reports and **F38** tax estimates derive from real categorized data rather than manual input.
- **Finance/report CSV export ("accountant export")** → extend **F29**: export expenses/reports to CSV/S3 (distinct from F30 system backup).

Confirmed already-covered (no action): FX rate **source+cache** (F37 ECB + `fx_rates`), duplicate detection (F12/F14), receipt line-item VAT/manufacturer (F13), reports/stats/period framing (F29/F38), entry event log (audit F00 + F34), accounts/users/S3/mailer (F12/F01/F05+F30/SES).

### N.2 The intelligent capture pipeline (Kanzen's elevation of marvis)
marvis was CSV + manual/rule categorisation. Kanzen runs a single **AI-automated pipeline** — a human confirms only where invariants require it. This is the headline differentiator.

**Capture → OCR → categorise → reconcile → post → propose inventory → confirm**
1. **Capture** — emailed receipt (F25) · mobile photo (F31) · upload (F05) · bank feed (F12).
2. **OCR / extract** — Claude-on-Bedrock multimodal → versioned line items (**F13**).
3. **Categorise (ML)** — layered rules → **pgvector** nearest-neighbour over confirmed history → Claude for novel items, each with confidence; **learns on every confirm** (**F13** + **F27**).
4. **Reconcile** — transaction ↔ receipt (amount/date/merchant + embeddings/Claude), confidence-gated (**F14**).
5. **Post** — balanced double-entry to **TigerBeetle** (**F18**), hidden in the UI.
6. **Promote to inventory** — qualifying line items (watch, guitar, art…) are **proposed as inventory assets** (**F04**) carrying provenance: price→`acquisition_cost`, merchant/date, the **immutable receipt as proof** (F05), warranty (F21) → feeds valuation (F20) + lifetime cost (F19).
7. **Confirm** — the human confirms in **Triage** (**F26**).

**Automation principle (F27):** automate as far as confidence + invariants allow. Non-financial steps (categorise/tag) may **auto-apply** above per-category confidence thresholds; **financial postings and asset/inventory creation are ALWAYS proposed, never auto-committed** — automation proposes, the Principal decides.

**Already specced** (no new feature needed): OCR + ML categorisation + line-item→asset proposal (F13 incl. AC5), ML reconciliation (F14), TB postings (F18), learned trust/rules (F27), agent + mobile capture (F25/F31), Triage confirm (F26). This section makes the **end-to-end thread** + the **receipt→inventory promotion with provenance** the explicit product north star.
