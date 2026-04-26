import { rateLimit, clientIp, readJsonBody, send } from '../_db.js';
import {
  isSiteAuthEnabled,
  timingSafeEqualPassword,
  createSessionCookieValue,
  buildSetSessionCookieHeader,
  getSitePassword,
} from '../_auth.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { error: 'Method not allowed' });
    }

    if (!isSiteAuthEnabled()) {
      return send(res, 400, { error: 'Site login is not configured' });
    }

    const ip = clientIp(req);
    if (!rateLimit(`auth:login:${ip}`, { max: 12, windowMs: 60_000 })) {
      return send(res, 429, { error: 'Too many attempts, try again in a minute.' });
    }

    const body = await readJsonBody(req);
    const password = body && typeof body.password === 'string' ? body.password : '';
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
