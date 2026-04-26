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

-- Keeper nominations (e.g. 3 keepers: #1 guaranteed, #2/#3 subject to league random rules — stored for commissioner)
create table if not exists keeper_nominations (
  id                  uuid primary key default gen_random_uuid(),
  sleeper_user_id     text not null check (length(sleeper_user_id) between 4 and 80),
  source_season       text not null check (length(source_season) between 3 and 8),
  league_id_snapshot  text null check (league_id_snapshot is null or length(league_id_snapshot) <= 40),
  nomination_kind     text not null default 'roster' check (nomination_kind in ('roster', 'freeform')),
  k1_player_id        text null check (k1_player_id is null or length(k1_player_id) <= 40),
  k2_player_id        text null check (k2_player_id is null or length(k2_player_id) <= 40),
  k3_player_id        text null check (k3_player_id is null or length(k3_player_id) <= 40),
  k1_text             text null check (k1_text is null or length(k1_text) <= 160),
  k2_text             text null check (k2_text is null or length(k2_text) <= 160),
  k3_text             text null check (k3_text is null or length(k3_text) <= 160),
  submitted_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (sleeper_user_id, source_season)
);

create index if not exists keeper_nominations_season_idx on keeper_nominations (source_season desc);
