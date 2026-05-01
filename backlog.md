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

## "My Team" page (`/me`)

**Goal:** A personal landing page for the logged-in member showing their roster from the most recent linked season, plus a small season summary and their current keeper picks. Surfaced via a personalised "Welcome back" hero card on `/` rather than a sixth bottom-nav tab (mobile real estate is already tight at five).

**Feasibility:** High: all data already available. `useAuth().user.sleeperUserId` (per-member login) plus `resolveLeagueHistoryChain` → `fetchSeasonBundle(chain[0].leagueId)` gives users, rosters, matchups, winners bracket. `getNflPlayersLookup()` resolves player ids. `computeStats` already returns the per-user record/PF/PA. `Keepers.jsx` already implements the same `lockedSleeperUserId` pattern we'd reuse here.

**Recommended scope (Tier 1 + 2 + 4):**

- **Roster (Tier 1):** team avatar + team name + manager display name; roster grouped by position (QB / RB / WR / TE / K / DEF / Bench / IR), starters marked from `roster.starters`. Each row: name, position, NFL team.
- **Season summary (Tier 2):** record (W-L-T), PF, PA, current standing, best/worst week, current streak, next opponent (next un-played week from `matchupsByWeek` + opponent's record). All free from the cached bundle that `Stats` already fetches.
- **Keepers card (Tier 4):** filter `/api/keeper-nominations` by `sleeper_user_id` for this season's picks; "Edit on Keepers page" link. Lift `myLatest` rendering out of `Keepers.jsx` into a shared component if it stays useful in both places.
- **Home hero entry point:** for logged-in members, swap the generic `home-hero__intro` for a "Welcome back, {team_name}" card that links to `/me`. Keep the existing copy as the fallback for site-password-only sessions.

**Edge cases to decide up-front:**

- **Site-password-only sessions** have no `sleeperUserId` — show a friendly "sign in with your member account to see your team" state, not a 404. Mirror the `lockedSleeperUserId` pattern from `Keepers.jsx`.
- **Commissioner view-as:** allow `?user=<sleeper_id>` for commissioners (same role check `Keepers.jsx` uses) so a commish can browse any team.
- **Manager not in current roster:** if `lockedSleeperUserId` isn't in `users` for `chain[0]`, fall back to the most recent season they appear in.
- **Pre-draft offseason:** `chain[0]` may be `status === 'pre_draft'` with no rosters; fall back to the latest season that has rosters so the page isn't empty.

**Out of recommended scope (parked for later iterations):**

- **Tier 3** weekly schedule strip (W/L pill per week, score, opponent avatar, click for matchup detail) — built from `matchupsByWeek`.
- **Tier 5** career view across linked seasons (all-time W-L, championships from `winnersBracket`, average finish, trophy case) — uses `fetchLeagueHistoryBundles`.
- **Tier 6** personal H2H "Rivals" rows — filter `computeHeadToHeadRecords` to the logged-in user.
- **Tier 7** past rosters / drafts / keepers timeline per season — `fetchLeagueDrafts` + `fetchDraftPicks` exist; needs a season tab UI.
- **Tier 8** transactions feed (trades, waivers, FA moves) — needs new `sleeper.js` helper for `/league/{id}/transactions/{round}`.

**Rough scope (recommended tiers only):** ~1 day. New `/me` route + page in `App.jsx`/`pages/`, reuses `fetchUsers`, `fetchRosters`, `getNflPlayersLookup`, `computeStats`, `/api/keeper-nominations`. Zero new lib code, zero new API routes, zero migrations.
