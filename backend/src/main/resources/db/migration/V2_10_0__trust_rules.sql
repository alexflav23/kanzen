-- F27 trust model (specs/F27). Per-category routing; financial categories locked to review.
create table trust_settings (
  id       uuid primary key default gen_random_uuid(),
  category text unique not null,
  routing  text not null default 'review',  -- review|auto
  locked   boolean not null default false
);
