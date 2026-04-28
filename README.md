# Fantasy Dashboards

A mobile-first Vite + React app for a Sleeper fantasy football league.

- `/` — League standings snapshot
- `/stats` — Previous-season recap (highs, lows, blowouts, bench points, consistency)
- `/wheel` — Spin-the-wheel keeper picker (weighted, with history)
- `/drafts` — **Draft board** per linked season: teams as columns, rounds as rows (Sleeper picks + `draft_order`)
- `/rules` — Rule suggestions, voting, and **per-rule discussion** threads
- `/keepers` — Manager keeper nominations (roster picks from a past season or freeform text; stored in Postgres for the commissioner). Optional `VITE_KEEPERS_REVEAL_AT` (ISO 8601) hides the **All nominations** table until that time; the API still returns data if called directly, so treat this as a league courtesy, not a secret lock.

Hosted on Vercel. Voting state lives in Neon Postgres (free tier). Sleeper data is read from the public Sleeper API.

## Stack

- Vite + React (JavaScript), `react-router-dom`
- Vercel serverless functions in `/api/*.js`
- Postgres via `pg` and `DATABASE_URL` (local / pgAdmin, Docker, or Neon TCP connection strings)
- No service worker; manifest + icons only for PWA install

## Local development

### 1. Prerequisites

- Node 18 or newer
- A Sleeper league id (the long number in your league URL on `sleeper.app`)
- Optional: a Neon connection string for testing the rules/voting API locally

### 2. Install and configure

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```
VITE_SLEEPER_LEAGUE_ID=your_league_id_here
DATABASE_URL=postgres://...   # only needed if you want to test /api locally
# Optional: VITE_KEEPERS_REVEAL_AT=2026-08-20T12:00:00-04:00
```

### 3. Run

**Important:** `npm run dev` starts **Vite only**. It does **not** run `/api/*` (those are Vercel serverless functions). If you open `/rules` with only Vite, the Rules page cannot talk to Postgres until you use `vercel dev` below.

For **Home, Stats, and Wheel** (Sleeper only):

```bash
npm run dev
```

Then visit http://localhost:5173.

With `npm run dev`, Vite serves **`/api/auth/*` only** (so optional `SITE_PASSWORD` login works from `.env.local`). Other `/api/*` routes still return 503 until you run `npx vercel dev` (needed for Rules + Postgres).

For **Rules, keeper nominations, and voting** (needs `DATABASE_URL` and `db/schema.sql` applied):

```bash
npx vercel dev
```

Use the URL printed in the terminal (often http://localhost:3000). `vercel dev` runs Vite **and** the `/api` routes against your `.env` `DATABASE_URL` (local Postgres or Neon).

`DATABASE_URL` must be a real connection string, e.g. `postgresql://postgres:YOUR_PASSWORD@localhost:5432/fantasy_dashboard` — use your actual password, not placeholder braces.

First-time Vercel CLI may ask you to log in and link the project; that is normal for local dev.

## Database setup (Neon)

Run `db/schema.sql` once against your Neon database. Easiest path:

1. Open the Neon dashboard for the project that the Vercel integration provisioned.
2. Open the SQL editor.
3. Paste the contents of `db/schema.sql` and run it.

The script is idempotent, so re-running it is safe.

## Deployment to Vercel

1. Push this repo to GitHub.
2. In Vercel, "Add New → Project" and import the repo. Vercel auto-detects the Vite framework preset.
3. In the project's "Storage" tab, click "Connect Database → Neon" and provision a new Postgres. This injects `DATABASE_URL` automatically.
4. In "Settings → Environment Variables", add:
   - `VITE_SLEEPER_LEAGUE_ID` — your Sleeper league id, in all environments (Production, Preview, Development).
   - Optional **site login** (shared password for everyone in the league): set `SITE_PASSWORD` to a passphrase and `AUTH_SECRET` to a long random string (at least 16 characters). If either is missing or `AUTH_SECRET` is too short, login is disabled and the app stays public. Add both to Production (and Preview if you use preview deploys).
   - Optional **per-member logins** (after `app_users` exists in `db/schema.sql`): set **`APP_USERS_ENABLED`** to `1`, `true`, or `yes` on **Production** (and Preview if you use it), alongside **`DATABASE_URL`** and **`AUTH_SECRET`** (at least 16 characters). Without all three, the app stays public and there is no sign-in gate. Create rows with `npm run create-user -- <username> <password> [sleeper_user_id]` (requires Node 20+ for `--env-file` in the script). You can use member accounts only, shared password only, or both; the sign-in page adapts.
5. Apply the schema: Neon dashboard → SQL editor → paste `db/schema.sql` → run.  
   If you already ran an older `schema.sql`, run it again (it is idempotent) so new tables such as **`rule_posts`** exist for per-rule discussions.
6. Trigger a deploy. Visit your `*.vercel.app` URL.
7. Sanity check:
   - `/api/rules` should return `{ "rules": [] }`.
   - `/stats` should populate after a few seconds.

## File layout

```
api/                Vercel serverless functions (Node 18, ESM)
  _db.js              shared Postgres pool + helpers
  _pgErrors.js        detect missing tables / Postgres error shapes
  _auth.js            optional shared-password + member session (HMAC cookie)
  _password.js        scrypt password hashes for app_users
  auth/config.js      GET — which login modes are enabled (no cookie)
  auth/me.js          session status + optional `user` for member sessions
  auth/login.js       POST username/password or shared password → Set-Cookie
  auth/logout.js      clear session cookie
  rules.js            GET, POST (includes `post_count` per rule)
  votes.js            POST, DELETE
  rule-posts.js       GET, POST, DELETE — forum messages under a rule
  keeper-nominations.js  GET, POST — manager keeper slots (roster or freeform)
db/
  schema.sql          one-time database setup
public/
  manifest.webmanifest
  icons/              192/512/maskable SVG icons
src/
  main.jsx
  App.jsx             routing + lazy-loaded pages
  config.js           reads VITE_SLEEPER_LEAGUE_ID
  lib/
    sleeper.js        Sleeper API helpers + previous-season walker + drafts
    stats.js          pure functions for derived stats
    drafts.js         draft board helpers (uses `buildTeams` for picker names)
    voter.js          voter token + my-votes localStorage
  pages/              Home, Stats, Wheel, Drafts, Rules, Keepers, HeadToHead
  components/         Nav, BottomSheet, Wheel, RuleCard, RuleDiscussionSheet
  styles/             tokens.css, globals.css
index.html
vercel.json           SPA rewrites (everything except /api -> index.html)
vite.config.js
```

## Mobile-first notes

- Layout designed for portrait phone first (~360–430 px wide).
- Bottom tab bar nav on mobile, sticky top nav on desktop (≥ 768 px).
- All tap targets ≥ 44×44 px; iOS safe-area handled in shell, nav, and bottom sheet.
- Inputs use `inputmode`/`enterkeyhint` for better keyboards; base font 16 px to prevent zoom on focus.
- Wheel sized to `min(90vw, 480px)` so it never overflows.
- Result modal becomes a bottom sheet on mobile; brief vibration on result where supported.
- `React.lazy` per route so phones on slow data only download the page they visit.

## Voting model

- Each browser generates a random `voter_token` (UUID) on first vote, stored in `localStorage`.
- Votes are upserted on `(rule_id, voter_token)` so toggling, switching, or removing a vote is idempotent.
- The Vercel function adds a best-effort per-IP rate limit per function instance (cold-start aware, fine for a small league).

## Rule discussions

- Each rule has a linear thread in `rule_posts` (oldest first in the UI).
- The same browser token used for voting (`voter:token` / `getVoterToken()`) is sent as `poster_token` when posting; the API never exposes other users’ tokens. Pass `X-Poster-Token` on `GET /api/rule-posts` so responses include `mine: true` on your own messages (for **Delete**).
- Deleting a post requires the same `poster_token` that created it.

## Out of scope (v1)

- Per-user accounts or OAuth (only optional shared site password + HttpOnly cookie)
- Server-side caching of Sleeper data
- Real-time vote updates (refetch on action)
- Optimal-lineup analysis (would require fetching the full Sleeper player database)
- Offline mode / service worker
