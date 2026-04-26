# Fantasy Dashboard

A mobile-first Vite + React app for a Sleeper fantasy football league.

- `/` — League standings snapshot
- `/stats` — Previous-season recap (highs, lows, blowouts, bench points, consistency)
- `/wheel` — Spin-the-wheel keeper picker (weighted, with history)
- `/rules` — Rule suggestions and voting

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
```

### 3. Run

**Important:** `npm run dev` starts **Vite only**. It does **not** run `/api/*` (those are Vercel serverless functions). If you open `/rules` with only Vite, the Rules page cannot talk to Postgres until you use `vercel dev` below.

For **Home, Stats, and Wheel** (Sleeper only):

```bash
npm run dev
```

Then visit http://localhost:5173.

For **Rules + voting** (needs `DATABASE_URL` and `db/schema.sql` applied):

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
5. Apply the schema: Neon dashboard → SQL editor → paste `db/schema.sql` → run.
6. Trigger a deploy. Visit your `*.vercel.app` URL.
7. Sanity check:
   - `/api/rules` should return `{ "rules": [] }`.
   - `/stats` should populate after a few seconds.

## File layout

```
api/                Vercel serverless functions (Node 18, ESM)
  _db.js              shared Neon client + helpers
  rules.js            GET, POST
  votes.js            POST, DELETE
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
    sleeper.js        Sleeper API helpers + previous-season walker
    stats.js          pure functions for derived stats
    voter.js          voter token + my-votes localStorage
  pages/              Home, Stats, Wheel, Rules
  components/         Nav, BottomSheet, Wheel, RuleCard
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

## Out of scope (v1)

- Real authentication / accounts
- Server-side caching of Sleeper data
- Real-time vote updates (refetch on action)
- Optimal-lineup analysis (would require fetching the full Sleeper player database)
- Offline mode / service worker
