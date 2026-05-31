-- F44 — Workspace domain-wide auth substrate (per-tenant). One row per tenant that's connected a Google Workspace.
-- The private key NEVER lives in Postgres: only the Secrets Manager reference (dev: an age-encrypted blob ref). The
-- live token-exchange (service account JWT -> impersonated access token) wires in behind the WorkspaceAuth seam once
-- the operator provisions the service account; the row + validation state are managed here.
create table if not exists workspace_integrations (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  domain                text not null,
  service_account_email text not null,
  secrets_manager_ref   text not null,
  authorized_scopes     text[] not null default '{}',
  validated_at          timestamptz,
  validation_error      text,
  created_by            uuid not null references users(id),
  created_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  unique (tenant_id, domain)
);
create index if not exists workspace_integrations_tenant_idx on workspace_integrations(tenant_id);
