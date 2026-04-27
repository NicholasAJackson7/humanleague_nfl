# Backlog

Parked ideas and follow-ups (not committed work).

## Per-user login (whole app)

**Goal:** Every league participant has their **own** username/password (or equivalent), not a shared site password. Logged-in identity drives what they can see and do across the app. Accounts are **commissioner-managed** (create / reset / disable); open signup is out of scope unless requirements change.

**Feasibility:** High: DB users table, password hash (e.g. bcrypt/argon2), HttpOnly signed session cookie (same general pattern as today’s `hl_site` / `AUTH_SECRET`), `/api/auth/me` exposes user id + role + bound `sleeper_user_id` where applicable. Migrate away from optional shared `SITE_PASSWORD` once per-user auth covers the routes you need.

**Rough scope:**

- DB: `users` (or `managers`) with username, password hash, `sleeper_user_id`, `disabled`, optional `role` (`manager` | `commissioner`).
- Login / logout; protect app routes and APIs with session checks; commissioner-only actions gated by role.
- Dev parity: extend `vite.dev-auth-api` (or equivalent) for new auth endpoints.
- Optional later: commissioner UI for create/reset/disable instead of SQL/scripts.

### First hard use case: keeper nominations

- `POST /api/keeper-nominations`: require a user session whose `sleeper_user_id` is set; **ignore** client-supplied `sleeper_user_id`.
- Keepers UI: drop “pick yourself” when the session already identifies the manager.
- `GET /api/keeper-nominations`: decide full league vs own row by role; note that `VITE_KEEPERS_REVEAL_AT` is UI-only for hiding — true read privacy needs API rules.

**Note:** Sleeper-native SSO for every manager remains uncertain unless Sleeper exposes reliable third-party auth for league members.
