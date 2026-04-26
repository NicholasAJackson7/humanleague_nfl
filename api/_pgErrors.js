/**
 * Detect Postgres "relation does not exist" (e.g. migration not applied yet).
 * Works with node-pg errors and some wrapped shapes.
 */
export function isUndefinedRelation(err, relationName) {
  const code = err && (err.code || err.cause?.code);
  if (code === '42P01') return true;
  const msg = String((err && err.message) || err?.cause?.message || '');
  const escaped = relationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`relation\\s+"${escaped}"\\s+does\\s+not\\s+exist`, 'i').test(msg);
}
