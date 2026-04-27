import crypto from 'crypto';

export const AUTH_COOKIE = 'hl_site';

const MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days

export function getSitePassword() {
  const p = process.env.SITE_PASSWORD;
  return typeof p === 'string' && p.length > 0 ? p : '';
}

function authSecret() {
  const s = process.env.AUTH_SECRET;
  return typeof s === 'string' && s.length > 0 ? s : '';
}

/** When true, UI and protected API routes require a valid session cookie. */
export function isSiteAuthEnabled() {
  return getSitePassword().length > 0 && authSecret().length >= 16;
}

/** Per-user accounts: commissioner sets APP_USERS_ENABLED=1 after running schema + creating users. */
export function isUserAuthEnabled() {
  const db = process.env.DATABASE_URL;
  return (
    typeof db === 'string' &&
    db.length > 0 &&
    authSecret().length >= 16 &&
    process.env.APP_USERS_ENABLED === '1'
  );
}

/** Site-wide protection: shared password and/or member accounts. */
export function isAuthProtectionEnabled() {
  return isSiteAuthEnabled() || isUserAuthEnabled();
}

function signPayload(obj) {
  const secret = authSecret();
  const payload = Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;
  const secret = authSecret();
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!json || typeof json.exp !== 'number') return null;
    if (Date.now() > json.exp) return null;
    return json;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function getSessionTokenFromRequest(req) {
  const raw = parseCookies(req.headers.cookie || '')[AUTH_COOKIE];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export function sessionIsValid(req) {
  if (!isAuthProtectionEnabled()) return true;
  const token = getSessionTokenFromRequest(req);
  return verifyToken(token) != null;
}

/** Parsed session payload, or null. `sub` is present for member (app user) sessions. */
export function getSessionPayload(req) {
  const token = getSessionTokenFromRequest(req);
  return verifyToken(token);
}

/**
 * If site auth is on and the request has no valid session, sends 401 and returns false.
 * Otherwise returns true (caller should continue).
 */
export function assertSiteAuth(req, res, send) {
  if (!isAuthProtectionEnabled()) return true;
  if (sessionIsValid(req)) return true;
  send(res, 401, { error: 'Unauthorized' });
  return false;
}

export function timingSafeEqualPassword(plain, expected) {
  const a = Buffer.from(plain, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** @param {Record<string, unknown>} [extra] e.g. `{ sub: userUuid }` for member sessions */
export function createSessionCookieValue(extra = {}) {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  return signPayload({ exp, ...extra });
}

export function buildSetSessionCookieHeader(token) {
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const flags = ['Path=/', `Max-Age=${MAX_AGE_SEC}`, 'HttpOnly', 'SameSite=Lax'];
  if (secure) flags.push('Secure');
  return `${AUTH_COOKIE}=${encodeURIComponent(token)}; ${flags.join('; ')}`;
}

export function buildClearSessionCookieHeader() {
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const flags = ['Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
  if (secure) flags.push('Secure');
  return `${AUTH_COOKIE}=; ${flags.join('; ')}`;
}
