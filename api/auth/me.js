import { send } from '../_db.js';
import { isSiteAuthEnabled, sessionIsValid } from '../_auth.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return send(res, 405, { error: 'Method not allowed' });
    }
    const enabled = isSiteAuthEnabled();
    if (!enabled) {
      return send(res, 200, { authenticated: true, authEnabled: false });
    }
    const ok = sessionIsValid(req);
    return send(res, 200, { authenticated: ok, authEnabled: true });
  } catch (err) {
    console.error('auth/me error', err);
    return send(res, 500, { error: 'Server error' });
  }
}
