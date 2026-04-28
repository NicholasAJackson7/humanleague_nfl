import { getSql, rateLimit, clientIp, readJsonBody, send } from './_db.js';
import { assertSiteAuth, getSessionPayload } from './_auth.js';

const USER_ID_RE = /^[0-9a-z]{8,40}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normStr(v, max) {
  const s = v == null ? '' : String(v).trim();
  if (s.length > max) return null;
  return s;
}

/**
 * Effective sleeper_user_id the account is allowed to act as. Prefers the
 * column, falls back to username when the username already looks like a
 * sleeper id (commissioner workflow: usernames mirror sleeper ids).
 */
function effectiveSleeperUserId(row) {
  if (!row) return null;
  const sid = row.sleeper_user_id;
  if (typeof sid === 'string' && USER_ID_RE.test(sid)) return sid;
  const name = row.username;
  if (typeof name === 'string' && USER_ID_RE.test(name)) return name;
  return null;
}

export default async function handler(req, res) {
  try {
    if (!assertSiteAuth(req, res, send)) return;

    const sql = getSql();

    if (req.method === 'GET') {
      const rows = await sql`
        select
          id,
          sleeper_user_id,
          source_season,
          league_id_snapshot,
          nomination_kind,
          k1_player_id,
          k2_player_id,
          k3_player_id,
          k1_text,
          k2_text,
          k3_text,
          submitted_at,
          updated_at
        from keeper_nominations
        order by source_season desc, updated_at desc
      `;
      return send(res, 200, { nominations: rows });
    }

    if (req.method === 'POST') {
      const ip = clientIp(req);
      if (!rateLimit(`keeper-nom:${ip}`, { max: 12, windowMs: 60_000 })) {
        return send(res, 429, { error: 'Too many requests, slow down a sec.' });
      }

      const body = await readJsonBody(req);
      if (!body || typeof body !== 'object') {
        return send(res, 400, { error: 'Invalid JSON body' });
      }

      const sleeperUserId = normStr(body.sleeper_user_id, 80);
      if (!sleeperUserId || !USER_ID_RE.test(sleeperUserId)) {
        return send(res, 400, { error: 'sleeper_user_id is required' });
      }

      // Member accounts may only nominate for their own team. Commissioners
      // can still edit on anyone's behalf. Site-password-only sessions (no
      // member account) keep the previous open behaviour for backwards compat.
      const session = getSessionPayload(req);
      const sub = session && typeof session.sub === 'string' ? session.sub : null;
      if (sub && UUID_RE.test(sub)) {
        const userRows = await sql`
          select username, role, sleeper_user_id, disabled
          from app_users
          where id = ${sub}
          limit 1
        `;
        const account = userRows[0];
        if (!account || account.disabled) {
          return send(res, 401, { error: 'Account is not active' });
        }
        if (account.role !== 'commissioner') {
          const allowed = effectiveSleeperUserId(account);
          if (!allowed) {
            return send(res, 403, {
              error: 'Your account is not linked to a Sleeper id yet — ask the commissioner to set one.',
            });
          }
          if (allowed !== sleeperUserId) {
            return send(res, 403, { error: 'You can only nominate keepers for your own team.' });
          }
        }
      }

      const sourceSeason = normStr(body.source_season, 8);
      if (!sourceSeason || sourceSeason.length < 3) {
        return send(res, 400, { error: 'source_season is required (e.g. 2025)' });
      }

      const kind = body.nomination_kind === 'freeform' ? 'freeform' : 'roster';
      const leagueSnap = normStr(body.league_id_snapshot, 40);

      let k1p;
      let k2p;
      let k3p;
      let k1t;
      let k2t;
      let k3t;

      if (kind === 'roster') {
        k1p = normStr(body.k1_player_id, 40);
        k2p = normStr(body.k2_player_id, 40);
        k3p = normStr(body.k3_player_id, 40);
        if (!k1p || !k2p || !k3p) {
          return send(res, 400, { error: 'Roster mode requires k1_player_id, k2_player_id, k3_player_id' });
        }
        k1t = null;
        k2t = null;
        k3t = null;
      } else {
        k1t = normStr(body.k1_text, 160);
        k2t = normStr(body.k2_text, 160);
        k3t = normStr(body.k3_text, 160);
        if (!k1t || !k2t || !k3t) {
          return send(res, 400, { error: 'Freeform mode requires k1_text, k2_text, k3_text' });
        }
        if (k1t.length < 2 || k2t.length < 2 || k3t.length < 2) {
          return send(res, 400, { error: 'Each keeper line must be at least 2 characters' });
        }
        k1p = null;
        k2p = null;
        k3p = null;
      }

      const [row] = await sql`
        insert into keeper_nominations (
          sleeper_user_id,
          source_season,
          league_id_snapshot,
          nomination_kind,
          k1_player_id,
          k2_player_id,
          k3_player_id,
          k1_text,
          k2_text,
          k3_text
        )
        values (
          ${sleeperUserId},
          ${sourceSeason},
          ${leagueSnap},
          ${kind},
          ${k1p},
          ${k2p},
          ${k3p},
          ${k1t},
          ${k2t},
          ${k3t}
        )
        on conflict (sleeper_user_id, source_season)
        do update set
          league_id_snapshot = excluded.league_id_snapshot,
          nomination_kind = excluded.nomination_kind,
          k1_player_id = excluded.k1_player_id,
          k2_player_id = excluded.k2_player_id,
          k3_player_id = excluded.k3_player_id,
          k1_text = excluded.k1_text,
          k2_text = excluded.k2_text,
          k3_text = excluded.k3_text,
          updated_at = now()
        returning id, sleeper_user_id, source_season, league_id_snapshot, nomination_kind,
          k1_player_id, k2_player_id, k3_player_id, k1_text, k2_text, k3_text, submitted_at, updated_at
      `;

      return send(res, 200, { nomination: row });
    }

    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('keeper-nominations handler error', err);
    return send(res, 500, { error: 'Server error' });
  }
}
