# F46 — Onboarding & setup flow

**Status**: 🟡 Spec — 2026-05-30. The first-run experience for a new tenant — sign-up to "you have a working Kanzen". Depends on F45 (tenancy) + F44 (Workspace auth) being in.

**Reads as**: a wizard backed by a `tenant_setup` state machine; designed so a tenant can break off mid-flow and resume, and so the Dashboard banner tells them exactly what's next.

---

## 1. The shape

```
       Sign up           Email                          Property              Initial          Operational         Optional
       /tenants    →     verify  →    Workspace   →     (first)      →        people    →      mailboxes    →    integrations  →  ✅ Tour (W9.6)
                                       (F44)                                                 (auto-provisioned)
```

Each step has:
- A small backend handler that mutates `tenant_setup.steps_done`.
- A web screen (or modal) presented in sequence.
- A "skip for now" option where the tenant won't be blocked from proceeding (with the Dashboard banner reminding them).

## 2. Data model

```sql
create table tenant_setup (
  tenant_id    uuid primary key references tenants(id) on delete cascade,
  -- Step name → completed_at; absent = not done. Step names match §3 below.
  steps_done   jsonb not null default '{}'::jsonb,
  current_step text,                  -- the next step the wizard should land on; null = done
  completed_at timestamptz,
  updated_at   timestamptz not null default now()
);
```

The wizard reads `current_step` to decide where to land; each step's handler updates `steps_done[<name>]` + advances `current_step`.

## 3. The steps

### 3.1 `account` — Tenant + principal
- Public `POST /api/tenants` (rate-limited): `{ name, slug, principal: { name, email, password } }`.
- Creates the tenant, the principal user, the principal's role grant (`principal`), and the `tenant_setup` row with `current_step = 'verify_email'`.
- Issues a magic-link email to the principal (operator-gated via SES; sandbox prints to log).

### 3.2 `verify_email` — Magic link
- GET `/onboard/verify?token=<sig>` → marks the principal's email verified, sets a token, advances to `workspace`.

### 3.3 `workspace` — Connect Google Workspace (F44)
- A "Connect Workspace" screen.
- Tenant admin pastes the service account JSON; backend stores it (Secrets Manager / dev: age-encrypted on disk) + writes the `workspace_integrations` row + runs the validation probe (F44 §4).
- The "what to do in Workspace admin console" sidebar appears with the exact steps (enable domain-wide delegation; authorise the client_id with the listed scopes).
- **Skip allowed** — the Dashboard banner will remind. (W9.5-class features stay greyed until done.)

### 3.4 `first_property` — Add the first property
- Form: `{ name, address, timezone, kind: residential|commercial }`.
- Backend uses F03 endpoints, scoped to the tenant.
- Creates a default `mailboxes` set scoped to this property (see §3.6).

### 3.5 `initial_people` — Invite staff (optional)
- Form: rows of `{ name, email, role, property? }`. Each row issues an invite (magic link). Roles: principal-only-by-default plus seeded {manager, staff, auditor}.

### 3.6 `mailboxes` — Operational mailboxes
- A list of suggested operational mailboxes (deliveries / accounts / house / vendors / concierge) and role/property addresses (wardian / singapore / principal / chief-of-staff).
- Tenant can rename or skip individual mailboxes.
- For each one ticked: Kanzen creates the `mail_inboxes` row AND (if Workspace is connected — §3.3) provisions the Google group / shared mailbox on the workspace side via Workspace Admin SDK. (Pending Workspace → just creates the Kanzen row; live provisioning happens once Workspace is connected.)

### 3.7 `optional_integrations` — Bank / market data / FX
- Optional cards: connect GoCardless (F12), market-data feed (F40), etc. **Skippable.**

### 3.8 `tour` — First-run guided tour (W9.6)
- Triggers the W9.6 `<GuidedTour>` against the Inbox once the user lands on the app for the first time.
- Marks `completed_at` on `tenant_setup`.

## 4. Dashboard banner

If `tenant_setup.completed_at IS NULL`:
- A pinned banner at the top of `/dashboard` listing the next step + a "Resume setup" CTA.
- Each step shows ✅ / ⏳ / 🔒 (blocked).

## 5. Authz of the wizard

- The wizard endpoints accept ONLY the tenant's principal user (the first user, who created the tenant) until setup completes.
- Once `verify_email` is done, the principal is a "real" principal in the F02v2 sense — every other authz rule applies normally.
- Tenant slug-uniqueness is enforced at the DB level.

## 6. UI structure

A single `/onboard` route owning the wizard:
- Top: progress strip showing steps + ✅ marks.
- Body: the current step's form.
- Bottom: "Save & continue" / "Skip for now" / "Back".

Each step is a small component in `web/src/onboard/<step>.tsx`. The orchestrator reads `current_step` and renders the right one.

Theme: warm-paper, the same tokens; uses `<AgentRibbon>` to brand each step ("Kanzen is setting up your household …").

## 7. Public signup

A `/signup` page (no auth):
- Tenant `name` + `slug` (auto-suggested from name; check uniqueness on blur).
- Principal `name` + `email` + `password`.
- Calls `POST /api/tenants` → redirects to `<slug>.kanzen.app/onboard` (or `/t/<slug>/onboard` in dev).

## 8. Operator inputs

Per tenant onboarding, the **tenant admin** brings:
- A Workspace domain + a GCP project + a service account with domain-wide delegation (the F44 inputs).
- Choice of operational mailbox names (defaults shipped).
- Properties (name, address, timezone).
- People (names, emails).

The **Kanzen operator** has already provisioned:
- A Cognito user pool with `custom:tenant_id` + `custom:tenant_slug` claims.
- An S3 bucket policy template for `kanzen-blobs/<slug>/...`.
- An SES sender for magic-link emails.
- A Terraform module that, given a slug, configures the DNS subdomain → CloudFront.

## 9. Testing

- **`OnboardingIT`**: full happy-path through the steps in order. Tenant created → email verified (stub) → Workspace connected (stub) → property + person added → mailboxes provisioned → completed_at set.
- **`TenantNoLeakIT` extension**: a tenant in the middle of setup can't read another tenant's data.
- **Resume**: kill the session mid-step; log back in; the wizard lands on `current_step`.
- **Web vitest + Playwright**: each step renders; "Skip for now" advances `current_step`; "Resume" from Dashboard banner deep-links into the right step.

## 10. Out of scope

- Per-step billing prompts. Plan upgrade flows live separately under `tenants.plan`.
- A "delete my tenant" flow. Operator tooling only for now.
- Importing existing data (CSV / Asset registry / contacts). Optional follow-up — F46.1.
