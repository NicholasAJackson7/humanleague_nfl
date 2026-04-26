-- Run this once against your Neon database (Neon SQL editor or psql).
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";

create table if not exists rules (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(title) between 1 and 140),
  description text not null default '' check (length(description) <= 2000),
  author      text null check (author is null or length(author) <= 60),
  created_at  timestamptz not null default now()
);

create index if not exists rules_created_at_idx on rules (created_at desc);

create table if not exists votes (
  rule_id      uuid not null references rules(id) on delete cascade,
  voter_token  text not null check (length(voter_token) between 8 and 80),
  value        smallint not null check (value in (-1, 1)),
  created_at   timestamptz not null default now(),
  primary key (rule_id, voter_token)
);

create index if not exists votes_rule_id_idx on votes (rule_id);

-- Per-rule discussion (forum-style thread)
create table if not exists rule_posts (
  id           uuid primary key default gen_random_uuid(),
  rule_id      uuid not null references rules(id) on delete cascade,
  body         text not null check (length(body) between 1 and 2000),
  author       text null check (author is null or length(author) <= 60),
  poster_token text not null check (length(poster_token) between 8 and 80),
  created_at   timestamptz not null default now()
);

create index if not exists rule_posts_rule_created_idx on rule_posts (rule_id, created_at asc);
