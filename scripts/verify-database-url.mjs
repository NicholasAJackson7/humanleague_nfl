import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';

function loadDatabaseUrlFromFile(path) {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^DATABASE_URL\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v || null;
  }
  return null;
}

function describeUrl(url) {
  try {
    const u = new URL(url);
    const user = u.username ? '(user set)' : '(no user)';
    return `${u.protocol}//${user}@${u.hostname}:${u.port || 'default'}/${u.pathname.replace(/^\//, '') || '(no db name)'}`;
  } catch {
    return '(could not parse as URL)';
  }
}

const url =
  process.env.DATABASE_URL ||
  loadDatabaseUrlFromFile('.env.local') ||
  loadDatabaseUrlFromFile('.env');

if (!url) {
  console.error('DATABASE_URL is missing. Set it in .env.local or .env.');
  process.exit(1);
}

if (!/^postgres(ql)?:\/\//i.test(url)) {
  console.error(
    'DATABASE_URL should start with postgresql:// or postgres:// (got different scheme).'
  );
  process.exit(1);
}

console.log('Resolved DATABASE_URL for:', describeUrl(url));

const pool = new pg.Pool({ connectionString: url, max: 1 });

try {
  const { rows } = await pool.query('select 1 as ok');
  if (rows?.[0]?.ok === 1) {
    console.log('Connection OK: database accepted a simple query.');
    process.exit(0);
  }
  console.error('Unexpected response:', rows);
  process.exit(1);
} catch (err) {
  console.error('Connection failed:', err.message || err);
  console.error(
    'Check: Postgres is running, host/port/database match, user/password are correct. If the password has special characters, URL-encode them in the string (e.g. ! → %21).'
  );
  process.exit(1);
} finally {
  await pool.end();
}
