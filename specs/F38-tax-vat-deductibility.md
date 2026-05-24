# Feature F38 — Tax, VAT & deductibility

| | |
|---|---|
| **Feature ID** | F38 |
| **Milestone** | M3 / Wave C (Finance) |
| **Domain** | Finance |
| **Status** | spec complete |
| **Depends on** | F13 (receipts/line items), F17 (expenses), F37 (FX), F29 (insights), F30 (exports) |
| **Spec references** | `gitlab.com/outworkers/marvis` (`domain/tax`, `domain/expenses`) — porting reference; SPEC §9 (finance); the implementation plan (`00-master-implementation-plan.md`) |

> **Decisions:** ported from marvis's tax engine (Joda-Money/Cassandra → **Postgres/Doobie, integer minor units**). Tax computation is **estimation/reporting only — Kanzen never files or pays tax** (consistent with "never moves money"). UK-first (income/dividend/salary/NI/corporation tax, VAT), tax-year aware, with bands held as **versioned config** (not hard-coded). **Principal-private** (F02).

---

## 1. Purpose & user value
Turn the household's normalized transactions (F12/F37) and itemised receipts (F13) into **tax intelligence**: which expenses are **deductible**, how much **VAT is reclaimable**, and an **estimate** of income/dividend/salary tax, National Insurance and corporation tax for a tax year — so the Principal (and their accountant) see the position at a glance and can export it. Marvis did exactly this for one user; Kanzen generalises it inside the family office.

## 2. Roles & permissions
Resources `tax_profile`, `tax_report` — **Principal-private** (F02): **Principal** `admin`; **Manager** `none` by default (tax is sensitive personal/company data; a documented carve-out can grant read of the *deductible-expense* report only); **Staff** `none`. The Agent may **propose** a deductible flag on an expense (F27) but never sets tax profile or files anything.

## 3. Data model
`V__tax.sql`:
- **`tax_profiles`** — `id, owner_id, subject ('personal'|'company'), tax_year text (e.g. '2025/26'), country text ('uk'), ni_category text null, personal_allowance_minor bigint, settings jsonb (taper rules, accounting basis), created_at, updated_at, deleted_at`.
- **`tax_bands`** — versioned config: `id, country, tax_year, kind ('income'|'dividend'|'ni'|'corporation'), name, lower_threshold_minor, higher_threshold_minor null, percentage numeric, sort_order`. (Seeded; editable by Principal.)
- **`expense_tax`** (extends F17/F13 expense line) — `expense_id, tax_rate_pct numeric, vat_amount_minor bigint, deductible bool, deductible_pct numeric (partial), vat_reclaimable bool, category text`. (May live as columns on the expense line — see F13/F17.)
- **`tax_reports`** — `id, owner_id, tax_year, kind, generated_at, totals jsonb (taxable, by-band breakdown, NI, deductible total, VAT reclaimable), export_id uuid null (F30)`.

All amounts integer minor units in a stated currency; cross-currency totals use **F37**-normalized values at transaction-date rate. All writes audited.

## 4. API (Tapir endpoints)
- **Profile**: `GET/POST/PATCH /api/tax/profiles` (Principal-only).
- **Bands**: `GET /api/tax/bands?country=&year=` · `PATCH` (Principal).
- **Estimate**: `POST /api/tax/estimate` `{salary, dividends, year}` → banded `TaxCalculation` (personal allowance + taper, income/dividend tiers, NI, corporation tax) — pure, no persistence.
- **Deductible report**: `GET /api/tax/deductible?year=` → deductible expenses + total + **VAT reclaimable**, FX-normalized.
- **Tax-year summary**: `GET /api/tax/summary?year=` → the dashboard figures; `POST /api/tax/reports` persists + optionally exports (F30).

## 5. UI / screens & states
A **Tax** screen (under Finance / or Insights):
- **Estimate** card: inputs (salary, dividends, year) → banded breakdown (each `AppliedTax` row: name, rate, applied-on, remaining), totals (total tax, NI, take-home), personal-allowance taper shown.
- **Deductible** panel: list of deductible expenses (provider, amount, tax%, VAT), running totals "tax-deductible" + "VAT reclaimable", filter by tag/category/period.
- **Tax year** selector; **Export** (CSV/PDF via F30).
- States: empty (no profile / no deductible expenses), loading, error, **forbidden** (non-Principal).

## 6. Business rules & validation
- **Bands are versioned config per `(country, tax_year, kind)`** — never hard-coded; editable by the Principal; the estimate uses the year's bands.
- **Personal allowance taper** (e.g. reduced above £100k); **dividend tiers** (free allowance then tiered rates); **NI** by category; **corporation tax** on company subject.
- **Deductibility**: per expense/line `deductible` + `deductible_pct` (partial); **VAT reclaimable** only when flagged + rate present. Totals exclude non-deductible.
- **FX**: all totals computed on F37-normalized minor-unit amounts at the transaction-date rate; the source currency is preserved.
- **Estimation only** — no endpoint files or pays tax; outputs are reports/exports.
- **Duplicate-safe**: deductible totals respect F14 dedup (a duplicated transaction is not double-counted).

## 7. Integrations / external systems
None external. Consumes F13 receipts/line items, F17 expenses, F37 FX rates; exports via F30 (S3). (HMRC/MTD filing explicitly **out of scope** — Kanzen never files.)

## 8. Edge cases
- Tax-year boundary (expense dated 5 vs 6 April) → assigned by date to the correct year.
- Allowance taper crossing £100k; negative/zero taxable; dividends-only.
- Mixed-currency deductibles → normalized via F37 before totalling.
- Zero-rated / exempt / reverse-charge VAT → reclaimable=false even if rate present.
- Partial-deductible (e.g. 50% of a mixed-use expense).
- Band config missing for a requested year → clear error, no silent default.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Banded tax estimate**  ‹maps: `TaxEstimateSpec` (FreeSpec), `TaxEstimateIT`, web `tax.spec` estimate›
- **Given** the 2025/26 UK bands are seeded and Toby has a tax profile
- **When** Toby requests an estimate for salary £85,000 + dividends £20,000
- **Then** the response shows a banded breakdown (personal allowance, basic/higher income bands, dividend tiers, NI) with per-band `AppliedTax` rows and a correct total tax + take-home
- **And** the calculation is pure — nothing is persisted or filed.

**AC2 — Personal-allowance taper**  ‹maps: `TaxTaperSpec`›
- **Given** income above £100,000
- **When** the estimate runs
- **Then** the personal allowance is tapered per the year's rule and the taxable amount reflects it.

**AC3 — Deductible expense report + VAT reclaimable**  ‹maps: `DeductibleReportIT`, web `tax.spec` deductible›
- **Given** expenses flagged deductible with VAT rates (F13/F17), some non-deductible
- **When** Toby opens the deductible report for the year
- **Then** only deductible expenses are totalled, with a separate **VAT reclaimable** total
- **And** zero-rated/exempt lines contribute £0 VAT reclaimable.

**AC4 — FX-normalized totals (no double count)**  ‹maps: `TaxFxNormalizeIT`›
- **Given** a deductible expense in EUR and a duplicate transaction (F14)
- **When** the report totals
- **Then** the EUR amount is normalized to base currency at its transaction-date rate (F37) and the duplicate is **not** counted twice.

**AC5 — Tax is Principal-private (negative)**  ‹maps: `TaxAuthzIT`›  *(invariant: Principal-private; no leak)*
- **Given** Lorna (Manager) and Marcia (Staff)
- **When** either requests `/api/tax/*`
- **Then** both are **denied (403)** by default — no estimate, profile, or totals returned (a Manager carve-out, if configured, exposes only the deductible-expense report, never the profile or estimate).

**AC6 — Estimation only, never files/pays (invariant)**  ‹maps: `NoTaxFilingAssertionIT`›  *(invariant: Kanzen never files or moves money)*
- **Given** the tax module
- **When** the API surface is inspected
- **Then** there is **no endpoint that files or pays tax** (no HMRC/MTD/PIS) — outputs are reports/exports only.

**AC7 — Bands are versioned config**  ‹maps: `TaxBandConfigIT`›
- **Given** 2024/25 and 2025/26 band sets
- **When** Toby estimates for each year
- **Then** each uses its own year's bands; requesting a year with **no** band config returns a clear error (no silent default).

**AC8 — Agent proposes deductible, never decides (invariant)**  ‹maps: `AgentDeductibleProposeIT`›  *(invariant: agent proposes, never auto-commits)*
- **Given** the email agent (F25) processes a receipt it thinks is business-deductible
- **When** it runs
- **Then** it **proposes** `deductible=true` in Triage for Toby to confirm — it never sets the flag or the tax profile itself.

## 10. Test plan
- **Backend**: FreeSpec for the calculator (bands, taper, dividend tiers, NI, corporation tax) against known UK figures; weaver + Testcontainers for deductible report, FX normalization, dedup, band-config versioning; authz (Principal-only, Manager carve-out); `NoTaxFilingAssertion` (no filing/PIS endpoint).
- **Web**: Vitest for the estimate breakdown + deductible table; Playwright `tax.spec` (estimate, deductible report, export, forbidden-as-Manager) against the real API.

## 11. Observability & audit
Audit: profile create/edit, band edits, report generation/export, deductible-flag changes. Metrics: deductible total & VAT reclaimable by year, estimate runs, forbidden requests.

## 12. Open questions / decisions
1. **Manager carve-out** — expose the deductible-expense report to a Manager (operational) or keep tax wholly Principal-private? *(Lean: Principal-private; opt-in carve-out for the deductible report only.)*
2. **Scope of subjects** — personal only, or personal + a company entity (corporation tax)? *(Lean: support both `subject` values; company optional.)*
3. **Non-UK** — structure supports `country`, but only UK bands are seeded initially.
4. **Accountant export format** — CSV now; PDF/accountant-package later (F30).
