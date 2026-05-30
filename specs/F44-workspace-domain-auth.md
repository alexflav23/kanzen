# F44 — Workspace domain-wide auth (the integration substrate)

**Status**: 🟡 Spec — 2026-05-30. Foundation for W9.5 (Gmail send / read), Calendar Path B (two-way GCal sync), and future Drive read. **Per-tenant** — every tenant brings their own Workspace domain.

**Reads as**: the auth substrate the four downstream integrations share, so we don't re-invent OAuth + impersonation per producer.

---

## 1. The "why"

Today: nothing. The W9 collaborative inbox spec mentions Workspace + Gmail + Pub/Sub + Bedrock as operator-gated; the W9.4a `EmailSender` and Calendar Path B `CalendarSink` seams both compile against in-process sandbox impls. The live impls all need the same thing: **a backend that can act as any user inside the tenant's Workspace** (send mail as `wardian@kanzen.family`, write to Lorna's calendar, etc).

Google's answer for this is **Service Account + Domain-Wide Delegation**:
- The tenant's Workspace **super-admin** authorises a service account's `client_id` against the scopes the integration needs (`gmail.send`, `gmail.readonly`, `gmail.modify`, `calendar`, optionally `drive.readonly`).
- Kanzen holds the service account's **JSON key** (per tenant), exchanges it for a short-lived OAuth access token bound to the user being impersonated, scope-restricted to what the producer needs.

One auth substrate, four consumers (Gmail send, Gmail watch / history, Google Calendar API, Drive read).

## 2. Data model

```sql
-- One row per tenant that's connected a Google Workspace.
create table workspace_integrations (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references tenants(id) on delete cascade,
  domain                      text not null,       -- e.g. "kanzen.family"
  service_account_email       text not null,       -- e.g. "kanzen-relay@<proj>.iam.gserviceaccount.com"
  -- We DO NOT store the private key in Postgres. The Secrets Manager key id lives here; the JSON key
  -- material lives in AWS Secrets Manager (in dev: encrypted on disk via age + a dev passphrase).
  secrets_manager_ref         text not null,
  authorized_scopes           text[] not null default '{}',  -- recorded for transparency / drift detection
  validated_at                timestamptz,
  validation_error            text,
  created_by                  uuid not null references users(id),
  created_at                  timestamptz not null default now(),
  deleted_at                  timestamptz,
  unique (tenant_id, domain)
);
```

Per-tenant settings the integration relies on (lives in `tenants.settings jsonb` or a small `workspace_calendar_map` table):
- **Calendar per scope**: which Google Calendar id corresponds to which mailbox/property. E.g. `{ "wardian": "<gcal-id>", "singapore": "<gcal-id>", "principal": "<gcal-id>" }`.

## 3. The auth flow — `WorkspaceAuth.tokenFor`

A single tiny module producers all share:

```scala
package com.kanzen.workspace

import cats.effect.IO
import java.util.UUID
import io.circe.Json

trait WorkspaceAuth {
  /** A short-lived access token for `userEmail` in `tenantId`'s workspace, scoped to `scopes`.
    * Cached for ~50 min; refreshes itself. Throws WorkspaceNotConnected if the tenant has no integration. */
  def tokenFor(tenantId: UUID, userEmail: String, scopes: List[String]): IO[String]
}
```

Under the hood:
1. Look up `workspace_integrations` for `tenantId`. If missing → `WorkspaceNotConnected`.
2. Fetch the JSON key bytes from Secrets Manager (cached in-memory, per tenant, no expiry beyond process lifetime).
3. Build a JWT: `iss = service_account_email`, `sub = userEmail` (impersonation), `aud = "https://oauth2.googleapis.com/token"`, `scope = scopes.mkString(" ")`, `iat/exp` (1h).
4. Sign with the service account's RS256 private key.
5. POST it to `https://oauth2.googleapis.com/token` (grant_type `urn:ietf:params:oauth:grant-type:jwt-bearer`) → receive `{access_token, expires_in}`.
6. Cache `(tenantId, userEmail, scopes) → access_token` until `exp - 60s`.

Two production-grade properties baked in:
- **Per-(tenant, user, scopes) cache**: minimise calls to Google's token endpoint.
- **Scope minimality**: each producer requests only what it needs (e.g. `Calendar.sync` asks for `calendar`, `GmailSender` asks for `gmail.send`). No "all-the-scopes" tokens floating around.

## 4. Setup ergonomics

Admin pastes the service account JSON in **Settings → Integrations → Workspace** (gated `admin:integrations`):
- Validates JSON shape locally.
- Stores key bytes in Secrets Manager via `WorkspaceSetup.store(tenantId, json)`.
- Writes the `workspace_integrations` row (only the *reference*, never the key).
- Immediately calls a **validation probe**: `tokenFor(tenant, <admin-email>, ["openid", "https://www.googleapis.com/auth/userinfo.email"])` and `https://www.googleapis.com/oauth2/v3/userinfo`. If it returns the right `hd=domain`, set `validated_at`; otherwise persist `validation_error` (no key written).
- A "what to do in Workspace admin console" sidebar (the steps Google requires: enable domain-wide delegation, authorize the client_id with the listed scopes).

Test impersonation: a "Send test email to yourself" + "Read first event on the Wardian calendar" pair of buttons that exercise `WorkspaceAuth.tokenFor` end-to-end without writing anything destructive.

## 5. Consumers

Producers all import `WorkspaceAuth` and call `tokenFor` once per outbound call:

| Producer | Scopes |
|---|---|
| `GmailSender` (W9.4a / W9.5) | `gmail.send` |
| `GmailWatcher` (W9.5) | `gmail.readonly`, `gmail.modify` (for label sync) |
| `CalendarSyncConsumer` (Path B) | `calendar`, `calendar.events` |
| `DriveReader` (later) | `drive.readonly` |

Each is a `Consumer[Envelope]` from F34. The F34 event taxonomy carries the `tenant_id` + actor; the consumer maps `actor.email → impersonated subject` for `WorkspaceAuth.tokenFor`.

## 6. Failure modes

- **Workspace not connected**: producers receive `WorkspaceNotConnected`; the Relay records `last_error` on the outbox row and backs off; F34 monitoring surfaces it. The user sees a "Workspace not connected" banner on the relevant surface (Inbox / Calendar).
- **Key revoked / rotated**: Secrets Manager fetch fails → producers retry from cache for up to the cache TTL, then fall through to error. Setup screen flagged with a re-link prompt.
- **Scope drift**: if a scope is removed in Workspace admin, token request 403s; we record `scope_drift` on the integration and prompt the admin.

## 7. Testing

- **`WorkspaceAuthSpec`** (FreeSpec) — JWT shape, scope serialisation, cache hit/miss, exp math.
- **`WorkspaceSetupIT`** (Testcontainers) — paste JSON → row + Secrets Manager ref + validation_error path.
- **Sandbox `WorkspaceAuth` stub** — `WorkspaceAuth.Stub(domain="kanzen.local")` returns a fake token; producers exercised end-to-end against a recorded Google API response (no live Google calls in CI).
- **Live smoke** (operator-gated, manual): the "Send test email" + "Read first calendar event" buttons in Settings.

## 8. Out of scope

- The actual Gmail / Calendar / Drive integrations — they're separate specs (Gmail in W9.5 / Calendar in Path B). This spec only provides the auth substrate.
- OAuth user consent flows (we're using domain-wide delegation, not 3LO). Tenants who can't enable that (e.g. small free-tier Workspaces) get a degraded mode → spec'd later.

## 9. Operator inputs (→ `SETUP.md`)

Per tenant:
- A GCP project + service account with domain-wide delegation enabled (one-time, per tenant).
- The JSON key (one-time, per tenant — uploaded via Settings).
- Workspace super-admin authorises the service account client_id with the scopes we need (one-time, per tenant).

Reads back: the integration validates and shows a green checkmark; setup is durable beyond reboots.
