-- F45 follow-on — the triage stream (agent_actions) leaked across tenants: it had no tenant_id (it's not an
-- owner_id table). Give it one, backfilled from its thread's tenant where linked, else the default tenant, then
-- NOT NULL it. The Agent.listActions read filters on it so a tenant only ever sees its own proposals.
alter table agent_actions add column if not exists tenant_id uuid references tenants(id)
  default '7e000000-0000-0000-0000-000000000001';

update agent_actions a set tenant_id = t.tenant_id
  from email_threads t where a.thread_id = t.id and a.thread_id is not null;

alter table agent_actions alter column tenant_id set not null;
create index if not exists agent_actions_tenant_idx on agent_actions(tenant_id);
