/**
 * Print a fresh password hash (one line, starts with `hlv1$...`) for use in
 * SQL such as: update app_users set password_hash = '<paste>' where ...
 *
 *   node scripts/hash-password.mjs 'YourPassword!Here'
 */
import { hashPassword } from '../api/_password.js';

const pw = process.argv[2];
if (!pw) {
  console.error("Usage: node scripts/hash-password.mjs '<password>'");
  process.exit(1);
}
console.log(hashPassword(pw));
