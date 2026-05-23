# Feature F12 — Bank ingestion & transactions (open banking, AIS)

| | |
|---|---|
| **Feature ID** | F12 |
| **Milestone** | M3 (specced early at the user's request) |
| **Domain** | Finance |
| **Status** | ✅ spec complete |
| **Depends on** | F02 (authz). Feeds F13 (receipts), F14 (reconciliation), F15–F17, F18 (ledger) |
| **Spec references** | SPEC §9.1–9.2, §11, §19 #1; domain `FinancialConnection`/`FinancialAccount`/`BankTransaction` |

> **Decisions (this feature):** **read-only open banking (AIS)** via **GoCardless Bank Account Data** for the UK (current accounts, **Amex** cards, **Revolut** multi-currency, Coutts, …); **Singapore** is a separate connector (SGFinDex/Finverse — provider still open) behind one internal `BankFeed` abstraction; **CSV fallback** + manual entry. **No payment initiation (PIS) — Kanzen never moves money.** UK consent re-confirmed ~every **90 days**.

---

## 1. Purpose & user value
Automatically pull balances and transactions from the household's banks and cards — Amex, Revolut, Coutts, Singapore banks — into one normalised, deduplicated, raw-preserving transaction store. This is the external-facts layer beneath reconciliation (F14), the bill schedule (F15), expenses (F17) and the ledger (F18). Read-only: Kanzen sees the money, never moves it.

## 2. Roles & permissions
Resources `financial_connection`, `financial_account`, `bank_transaction` (Principal-private, F02):
- **Principal** — `admin`: connect/disconnect institutions, re-consent, view balances + raw payloads, all transactions.
- **Manager** — `read` on `bank_transaction` (needed to **run reconciliation**, F14) **but** field-denied on `financial_account.balance` and connection management (cannot link/unlink). No raw-payload access.
- **Staff** — `none`.

## 3. Data model
`V__bank.sql` (Flyway version assigned at M3 build order):

- **`financial_institutions`** — `id uuid pk`, `provider text` (`gocardless_bad`/`sgfindex`/`finverse`/`csv`/`manual`), `provider_institution_id text`, `name text`, `type text` (`bank`/`card`/`ewallet`), `country text`, `bic text null`, `logo_url text null`. (Amex, Revolut, Coutts, DBS…)
- **`financial_connections`** — `id uuid pk`, `owner_id`, `provider`, `provider_ref text` (GC **requisition/agreement** id), `institution_id → financial_institutions`, `status text` (`pending`/`active`/`expired`/`revoked`/`error`), `consent_expires_at timestamptz null`, `last_synced_at timestamptz null`, `error text null`, `created_at`, `deleted_at null`.
- **`financial_accounts`** — `id uuid pk`, `owner_id`, `connection_id → financial_connections`, `provider_account_id text`, `institution_id`, `name text`, `type text` (`current`/`savings`/`credit_card`/`ewallet`), `currency text`, `iban text null`, `masked_number text null`, `balance_minor bigint null`, `balance_at timestamptz null`, `status text`, `created_at`, `deleted_at null`. (Revolut → one row per currency sub-account.)
- **`bank_transactions`** — `id uuid pk`, `owner_id`, `account_id → financial_accounts`, `provider_transaction_id text null`, `dedup_hash text`, `booked_at date`, `value_at date null`, `pending bool`, `amount_minor bigint`, `currency text`, `direction text` (`debit`/`credit`), `description text`, `counterparty_name text null`, `merchant_id uuid null`, `category_id uuid null`, `internal_status text` (`new`/`categorised`/`ignored`/`transfer`), `reconciliation_state text default 'unmatched'` (F14 owns the state machine), `fx_rate_to_base numeric null`, `fx_as_of date null` (rate-at-date captured at ingestion, F37), `raw_payload_id uuid`, `created_at`. Unique `(account_id, provider_transaction_id)` when present; else unique `(account_id, dedup_hash)`.
- **`bank_transaction_raw_payloads`** — `id uuid pk`, `transaction_id`, `provider`, `payload jsonb`, `fetched_at`. **Immutable.**
- **`merchants`** — `id, owner_id, name, normalised_name, logo_url null, default_category_id null`. (Normalisation here; inference rules in F27.)
- **`transaction_categories`** — `id, owner_id, parent_id null, name, kind ('income'|'expense'|'transfer')`.
- **`bank_sync_jobs`** — `id, connection_id, kind ('initial'|'incremental'|'manual'|'balance'), status, started_at, finished_at, ingested int, error` (mirrors ghost-busters' `sync_jobs`). Idempotent.

## 4. API (Tapir endpoints)
- **Connect**: `GET /api/banking/institutions?country=GB` (available institutions from GC) · `POST /api/banking/connections` (create GC end-user agreement + requisition → returns the bank-auth redirect URL) · `GET /api/banking/connections/callback` (handle redirect; fetch + store accounts) · `GET /api/banking/connections` / `:id` · `POST /api/banking/connections/:id/reconsent` (new requisition on expiry) · `DELETE /api/banking/connections/:id` (revoke).
- **Sync**: `POST /api/banking/connections/:id/sync` (manual) — scheduled incremental sync runs via EventBridge.
- **Accounts**: `GET /api/banking/accounts` · `GET /:id` (balance Principal-only).
- **Transactions**: `GET /api/banking/transactions` (filter: account, date range, category, status, `q`; paginated) · `GET /:id` (raw payload Principal-only) · `POST` (manual) · `POST /api/banking/transactions/import-csv` (upload + column mapping) · `PATCH /:id` (categorise, mark `transfer`/`ignored`).
- **Reference**: merchants + categories CRUD.

## 5. UI / screens & states
The prototype keeps raw transactions low-key (the ledger is hidden; transactions surface via the **Reconciliation** Inbox stream). F12 adds:
- **Settings → Connections** (Principal): connected institutions (Amex, Revolut, Coutts…) with status, last-sync, **consent-expiry countdown**, and a **Reconnect** CTA when expiring; **Add connection** → pick institution → bank/card auth (GC redirect) → accounts appear. Disconnect.
- **Connections expiry → Inbox** (Reminders stream) + a dashboard nudge: "Revolut access expires in 6 days — reconnect."
- **Accounts/Transactions view** (Principal-only, understated, under Finance): accounts with balances + currency; a transactions list (date, description, merchant, amount, category, reconciliation chip) with filters + CSV import. (Manager sees the transactions list for reconciliation, **no balances**.)
- **CSV import**: upload → map columns (date/amount/description/currency) → preview → import.
- **States**: connecting / awaiting bank auth / active / **consent-expired** (amber, reconnect) / error (bank down, rate-limited); empty (no connections); sync-in-progress.

## 6. Business rules & validation
- **AIS only.** No PIS endpoints exist. (Reinforces "never moves money.")
- **Idempotent ingestion.** Dedup by `provider_transaction_id`, else `dedup_hash` (account+date+amount+description). Re-syncs never duplicate.
- **Pending → booked.** Pending transactions update in place when booked (provider id stable).
- **Multi-currency + FX-at-ingestion.** Each account carries its own currency; Revolut sub-accounts are distinct accounts. GoCardless gives each transaction's **native amount + currency + date**; at ingestion we **capture the daily FX rate to the reporting/base currency for that transaction's date** (`fx_rate_to_base`/`fx_as_of`, F37) and store it permanently — so unified-currency reporting converts at the **rate on the transaction date**, never today's. Native amounts remain the truth (no silent conversion of the stored value).
- **Consent lifecycle.** Track `consent_expires_at`; at expiry → `status=expired`, stop syncing, raise an Inbox reminder + Settings flag; `reconsent` mints a fresh requisition. Respect **GC Bank Account Data rate limits** (limited fetches/account/day) — schedule incremental sync conservatively (e.g. a few times/day), back off on 429.
- **Raw preserved + immutable**; normalised fields derived.
- **Transfers** between the household's own accounts are detectable (matching opposite amounts) and flagged `transfer` so they don't double-count (full logic F14).
- **Field-level**: balances Principal-only (F02).

## 7. Integrations / external systems
- **GoCardless Bank Account Data** (UK/EU AIS): institutions list, end-user agreement, requisition (hosted bank auth), accounts, balances, transactions. OAuth/secret in **Secrets Manager**. Poll-based (no transaction webhooks) → **EventBridge Scheduler** drives incremental sync; `bank_sync_jobs` records each run. Adapter implements the internal **`BankFeed`** interface.
- **Singapore connector** (SGFinDex/Finverse) — same `BankFeed` interface; provider still open (§19 #1); not built in v1's first pass.
- **CSV** + **manual** are degenerate `BankFeed` sources.

## 8. Edge cases
- Re-sync after downtime → backfill window; dedup holds.
- Consent expires mid-sync → partial sync recorded, connection flagged expired.
- GC rate-limit (429) → back off, retry next window; surface "last synced" honestly.
- Revolut multi-currency → N accounts; a single logical "Revolut" institution.
- Amex shows pending авторisations that later vanish → reconcile pending lifecycle (drop unbooked pending after expiry).
- Bank/card not on GC → CSV fallback path.
- Duplicate institution connected twice → allowed but warn; accounts dedup by `provider_account_id`.
- Revoked at the bank → next sync 401 → mark `revoked`, prompt reconnect.
- Manager attempts to view a balance or connect a bank → 403.

## 9. Acceptance criteria
- **AC1** Principal connects **Amex**, **Revolut** and a UK bank via GoCardless; accounts (incl. Revolut per-currency) appear with balances.
- **AC2** An incremental sync ingests new transactions idempotently (re-running creates no duplicates) and preserves raw payloads.
- **AC3** A pending transaction becomes booked without duplicating.
- **AC4** Consent nearing expiry raises an Inbox reminder; **Reconnect** restores syncing.
- **AC5** CSV import maps and ingests a statement; manual entry creates a transaction.
- **AC6** Manager can list transactions for reconciliation but cannot see balances or connect/disconnect (403); Staff sees nothing.
- **AC7** No PIS/payment endpoint exists anywhere in the API surface.

## 10. Test plan
- **Backend** (weaver + testcontainers-PG; GC mocked/sandbox): requisition→callback→accounts flow; idempotent ingestion (dedup by id and by hash); pending→booked update; multi-currency account creation; consent-expiry transition + reconsent; rate-limit backoff; CSV import mapping; field-level balance denial (Manager).
- **Web**: Vitest for the connections UI states + CSV mapper; Playwright e2e of add-connection (mocked GC) and the expiry/reconnect nudge.
- **Resilience**: sync job ret/idempotency under repeated runs; raw-payload immutability.

## 11. Observability & audit
- Audit: connection create/reconsent/revoke, manual transaction, CSV import, categorise/ignore/transfer.
- Metrics: per-connection sync success/lag, transactions ingested, dedup-collision rate, consent days-to-expiry, GC rate-limit hits.
- `bank_sync_jobs` is the operational record; alert on stale connections + expiring consents.

## 12. Open questions / decisions
1. **Singapore provider** (§19 #1) — SGFinDex vs Finverse vs Brankas; built in a later pass.
2. **Sync cadence vs GC limits** — confirm acceptable freshness (e.g. 4×/day) given Bank Account Data fetch caps.
3. **Transactions UI prominence** — given the "ledger hidden" ethos, how visible is the raw transactions list vs surfacing everything through reconciliation? *(Lean: understated Principal-only view + reconciliation in Inbox.)*
4. **Balance refresh** — on each sync vs on demand (rate-limit sensitive).
5. **GC commercial terms** — confirm Bank Account Data tier/limits for a private household scale.
