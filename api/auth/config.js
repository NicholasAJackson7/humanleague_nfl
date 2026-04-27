import { send } from '../_db.js';
import { isSiteAuthEnabled, isUserAuthEnabled, isAuthProtectionEnabled } from '../_auth.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return send(res, 405, { error: 'Method not allowed' });
    }
    return send(res, 200, {
      authEnabled: isAuthProtectionEnabled(),
      sitePasswordLogin: isSiteAuthEnabled(),
      userAccountsLogin: isUserAuthEnabled(),
    });
  } catch (err) {
    console.error('auth/config error', err);
    return send(res, 500, { error: 'Server error' });
  }
}
