import { rateLimit, clientIp, readJsonBody, send, getSql } from '../_db.js';
import {
  isSiteAuthEnabled,
  isUserAuthEnabled,
  timingSafeEqualPassword,
  createSessionCookieValue,
  buildSetSessionCookieHeader,
  getSitePassword,
} from '../_auth.js';
import { verifyPassword } from '../_password.js';

function normUsername(v) {
  if (v == null) return '';
  const s = String(v).trim();
  if (s.length < 2 || s.length > 48) return null;
  return s;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { error: 'Method not allowed' });
    }

    if (!isSiteAuthEnabled() && !isUserAuthEnabled()) {
      return send(res, 400, { error: 'Login is not configured' });
    }

    const ip = clientIp(req);
    if (!rateLimit(`auth:login:${ip}`, { max: 12, windowMs: 60_000 })) {
      return send(res, 429, { error: 'Too many attempts, try again in a minute.' });
    }

    const body = await readJsonBody(req);
    const password = body && typeof body.password === 'string' ? body.password : '';
    const username = normUsername(body && body.username != null ? body.username : '');

    if (username) {
      if (!isUserAuthEnabled()) {
        return send(res, 400, { error: 'Member accounts are not enabled on this deployment' });
      }
      let sql;
      try {
        sql = getSql();
      } catch {
        return send(res, 503, { error: 'Database is not configured' });
      }
      const rows = await sql`
        select id, password_hash, sleeper_user_id, role, disabled
        from app_users
        where lower(username) = lower(${username})
        limit 1
      `;
      const row = rows[0];
      if (password.length < 8) {
        return send(res, 400, { error: 'Password must be at least 8 characters' });
      }
      if (!row || row.disabled || !verifyPassword(password, row.password_hash)) {
        return send(res, 401, { error: 'Invalid username or password' });
      }
      const token = createSessionCookieValue({ sub: row.id });
      res.setHeader('Set-Cookie', buildSetSessionCookieHeader(token));
      return send(res, 200, { ok: true });
    }

    if (!isSiteAuthEnabled()) {
      return send(res, 400, { error: 'Username is required' });
    }

    const expected = getSitePassword();
    if (!timingSafeEqualPassword(password, expected)) {
      return send(res, 401, { error: 'Invalid password' });
    }

    const token = createSessionCookieValue();
    res.setHeader('Set-Cookie', buildSetSessionCookieHeader(token));
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('auth/login error', err);
    return send(res, 500, { error: 'Server error' });
  }
}
