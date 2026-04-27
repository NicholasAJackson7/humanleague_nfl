import { send, getSql } from '../_db.js';
import {
  isAuthProtectionEnabled,
  getSessionPayload,
} from '../_auth.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return send(res, 405, { error: 'Method not allowed' });
    }
    const enabled = isAuthProtectionEnabled();
    if (!enabled) {
      return send(res, 200, { authenticated: true, authEnabled: false, user: null });
    }

    const payload = getSessionPayload(req);
    if (!payload) {
      return send(res, 200, { authenticated: false, authEnabled: true, user: null });
    }

    const sub = payload.sub;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof sub === 'string' && uuidRe.test(sub)) {
      let sql;
      try {
        sql = getSql();
      } catch {
        return send(res, 200, { authenticated: false, authEnabled: true, user: null });
      }
      const rows = await sql`
        select id, username, role, sleeper_user_id, disabled
        from app_users
        where id = ${sub}
        limit 1
      `;
      const row = rows[0];
      if (!row || row.disabled) {
        return send(res, 200, { authenticated: false, authEnabled: true, user: null });
      }
      return send(res, 200, {
        authenticated: true,
        authEnabled: true,
        user: {
          username: row.username,
          role: row.role,
          sleeperUserId: row.sleeper_user_id,
        },
      });
    }

    return send(res, 200, { authenticated: true, authEnabled: true, user: null });
  } catch (err) {
    console.error('auth/me error', err);
    return send(res, 500, { error: 'Server error' });
  }
}
