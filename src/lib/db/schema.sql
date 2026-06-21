-- Durable session storage for AIDM (Supabase/Postgres).
-- Idempotent: safe to re-run.

create table if not exists sessions (
  session_id text primary key,
  state jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists recaps (
  id serial primary key,
  session_id text references sessions(session_id) on delete cascade,
  recap jsonb not null,
  created_at timestamptz default now()
);

create index if not exists recaps_session_idx on recaps(session_id);
