import pg from 'pg';

let _pool;

function getPool() {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Use a postgresql:// URL in .env.local (local Postgres / pgAdmin) or set it on Vercel (e.g. Neon).'
    );
  }
  _pool = new pg.Pool({
    connectionString: url,
    max: 10,
    connectionTimeoutMillis: 10_000,
  });
  return _pool;
}

/**
 * Tagged-template SQL (same call style as before). Values are sent as
 * parameters ($1, $2, …); safe for any Postgres reachable via TCP (local
 * Docker, pgAdmin’s server, Neon’s connection string, etc.).
 */
export function getSql() {
  const pool = getPool();
  return function sql(strings, ...values) {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) {
      text += `$${i + 1}` + strings[i + 1];
    }
    return pool.query(text, values).then((res) => res.rows);
  };
}

const buckets = new Map();

export function rateLimit(key, { max = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length > 0) return xff[0];
  return req.socket?.remoteAddress || 'unknown';
}

export async function readJsonBody(req) {
  try {
    const b = req.body;
    if (b != null) {
      if (Buffer.isBuffer(b)) {
        try {
          return JSON.parse(b.toString('utf8'));
        } catch {
          return null;
        }
      }
      if (typeof b === 'string' && b.length > 0) {
        try {
          return JSON.parse(b);
        } catch {
          return null;
        }
      }
      if (typeof b === 'object') return b;
    }
  } catch {
    /* e.g. @vercel/node getter throws ApiError: Invalid JSON on bad bodies */
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy();
        resolve(null);
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

export function send(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
}
