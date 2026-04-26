# Backlog

Parked ideas and follow-ups (not committed work).

## Per-manager login for keeper nominations

**Goal:** Each manager has their own login (commissioner-managed). They can only submit keeper nominations for their Sleeper team, not for another manager.

**Feasibility:** High, using commissioner-issued accounts mapped to Sleeper `user_id`. The API would bind `sleeper_user_id` from the session and ignore any client-supplied id on `POST /api/keeper-nominations`. Sleeper-native SSO for every manager is uncertain unless Sleeper exposes reliable third-party auth for league members.

**Rough scope:**

- DB table for managers: username, password hash, `sleeper_user_id`, optional `disabled`.
- Login/logout (HttpOnly session cookie), same general pattern as existing site auth.
- Tighten keeper nominations POST to require manager session; UI drops the “pick yourself” dropdown when logged in as a manager.
- Optional later: commissioner UI to create/reset/disable users; GET nominations visibility (own row vs full league).

**Note:** Hiding the public nominations table until a date (`VITE_KEEPERS_REVEAL_AT`) is UI-only; true privacy for reads would need API rules on `GET /api/keeper-nominations` if that matters.
