/**
 * Run a SQL migration file against the database in DATABASE_URL.
 *
 * Use this whenever a `db/migrations/*.sql` change needs applying so you're
 * guaranteed to run it on the same DB your dev server / API connect to (no
 * "ran the migration on the wrong Neon branch" mistakes).
 *
 * Usage:
 *   node --env-file=.env.local scripts/run-migration.mjs db/migrations/0001_user_votes.sql
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const arg = process.argv[2];
if (!arg) {
  console.error(
    'Usage: node --env-file=.env.local scripts/run-migration.mjs <path-to-sql-file>'
  );
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Pass --env-file=.env.local.');
  process.exit(1);
}

const file = path.resolve(arg);
let sql;
try {
  sql = await fs.readFile(file, 'utf8');
} catch (err) {
  console.error(`Could not read SQL file ${file}:`, err.message);
  process.exit(1);
}

// Pretty-print the host/db so it's obvious which DB we're about to touch.
const safe = url.replace(/(:[^:@]+@)/, ':***@');
console.log(`Migration: ${path.basename(file)}`);
console.log(`Target:    ${safe}`);

const pool = new pg.Pool({
  connectionString: url,
  connectionTimeoutMillis: 10_000,
});

try {
  // The migration files contain their own BEGIN/COMMIT, so we can run the
  // whole thing as one multi-statement query.
  await pool.query(sql);
  console.log('OK — migration applied.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
