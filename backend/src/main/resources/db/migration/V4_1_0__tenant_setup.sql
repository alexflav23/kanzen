-- F46 W10 — onboarding state machine. One row per tenant; the wizard reads current_step to decide where to land,
-- each step's handler stamps steps_done[<name>] + advances current_step. completed_at set once the tour is done.
create table if not exists tenant_setup (
  tenant_id    uuid primary key references tenants(id) on delete cascade,
  steps_done   jsonb not null default '{}'::jsonb,
  current_step text,
  completed_at timestamptz,
  updated_at   timestamptz not null default now()
);

-- The seeded default tenant is already fully set up (it predates onboarding) — mark it complete so it never shows the
-- Dashboard "finish setup" banner.
insert into tenant_setup (tenant_id, current_step, completed_at)
  values ('7e000000-0000-0000-0000-000000000001', null, now())
  on conflict (tenant_id) do nothing;
