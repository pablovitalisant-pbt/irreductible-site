// lib/db.js
// Cliente Neon PostgreSQL compartido.

import { neon } from '@neondatabase/serverless';

let _sql = null;
export function getSql() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}
