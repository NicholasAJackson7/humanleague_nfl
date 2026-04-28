-- Migration: switch rule votes from anonymous browser tokens to authenticated
-- app_users. Run once against your Neon DB (psql or the Neon SQL editor).
--
-- This is destructive: it wipes the existing votes table because the old rows
-- are keyed to opaque browser tokens that cannot be linked to user accounts.
-- We agreed to a clean slate.

begin;

-- 1. Drop the old table entirely (cleanest path; cascades from rules already).
drop table if exists votes;

-- 2. Recreate it, scoped to authenticated app users. Primary key is the
--    (rule, user) pair so each manager can have at most one vote per rule.
create table votes (
  rule_id    uuid not null references rules(id) on delete cascade,
  user_id    uuid not null references app_users(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (rule_id, user_id)
);

create index votes_rule_id_idx on votes (rule_id);
create index votes_user_id_idx on votes (user_id);

commit;
