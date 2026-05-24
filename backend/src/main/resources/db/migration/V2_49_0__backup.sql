-- F30 backup/export/restore — job + manifest bookkeeping. Principal-only. The archive itself
-- is a self-descriptive JSON document (manifest + dependency-ordered entity sections + per-
-- section sha256); restore replays it in safe dependency order. `age` encryption, S3 binary
-- streaming and annual immutable Object-Lock snapshots are infra, deferred to hardening.
create table export_jobs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid,
  mode          text not null default 'full',     -- full|selective
  status        text not null default 'completed', -- running|completed|failed
  object_counts jsonb,
  manifest      jsonb,
  size_bytes    bigint,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create table restore_jobs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid,
  mode        text not null default 'dry_run',    -- dry_run|full
  status      text not null default 'completed',
  applied     jsonb,
  error       text,
  created_at  timestamptz not null default now()
);

insert into permission_rules (role_name, resource, field, level) values
  ('principal', 'backup', null, 'admin')
on conflict (role_name, resource, field) do nothing;
