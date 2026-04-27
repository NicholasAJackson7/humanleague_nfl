import crypto from 'crypto';

const PREFIX = 'hlv1';
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, 64, SCRYPT_OPTS);
  return `${PREFIX}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(plain, stored) {
  if (typeof plain !== 'string' || typeof stored !== 'string' || !stored.startsWith(`${PREFIX}$`)) {
    return false;
  }
  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const salt = Buffer.from(parts[2], 'base64url');
  const expected = Buffer.from(parts[3], 'base64url');
  if (salt.length < 8 || expected.length < 32) return false;
  let actual;
  try {
    actual = crypto.scryptSync(plain, salt, expected.length, SCRYPT_OPTS);
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
