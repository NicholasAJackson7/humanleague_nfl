import { send } from '../_db.js';
import { buildClearSessionCookieHeader, isAuthProtectionEnabled } from '../_auth.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { error: 'Method not allowed' });
    }
    if (isAuthProtectionEnabled()) {
      res.setHeader('Set-Cookie', buildClearSessionCookieHeader());
    }
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('auth/logout error', err);
    return send(res, 500, { error: 'Server error' });
  }
}
