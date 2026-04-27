/**
 * Create a league member row in app_users (run schema.sql first).
 *
 * Example:
 *   node --env-file=.env.local scripts/create-user.mjs nicho "your-secure-pass" 1234567890abcdef
 *
 * Requires DATABASE_URL. Optional third arg: Sleeper user_id for keeper binding later.
 */
import { getSql } from '../api/_db.js';
import { hashPassword } from '../api/_password.js';

const username = process.argv[2];
const password = process.argv[3];
const sleeperUserId = process.argv[4] || null;

if (!username || !password) {
  console.error('Usage: node --env-file=.env.local scripts/create-user.mjs <username> <password> [sleeper_user_id]');
  process.exit(1);
}

const hash = hashPassword(password);
const sql = getSql();
const sid = sleeperUserId && String(sleeperUserId).trim() ? String(sleeperUserId).trim() : null;

await sql`
  insert into app_users (username, password_hash, sleeper_user_id)
  values (${username}, ${hash}, ${sid})
`;
console.log(`Created app user "${username}"${sid ? ` (Sleeper id ${sid})` : ''}.`);
process.exit(0);
