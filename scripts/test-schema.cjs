// scripts/test-schema.js
// Test de integración: valida el schema contra Neon
// Ejecutar: node scripts/test-schema.js
// Salida esperada (Fase B): ERROR — tabla subscribers no existe

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const REQUIRED_COLUMNS = [
  { name: 'id',              type: 'integer' },
  { name: 'email',           type: 'character varying' },
  { name: 'unsubscribe_token', type: 'uuid' },
  { name: 'status',          type: 'character varying' },
  { name: 'lead_magnet_sent_at', type: 'timestamp with time zone' },
  { name: 'created_at',      type: 'timestamp with time zone' },
  { name: 'unsubscribed_at', type: 'timestamp with time zone' },
];

const REQUIRED_INDEXES = [
  'idx_subscribers_email',
  'idx_subscribers_token',
  'idx_subscribers_status',
];

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  // 1. Verificar que la tabla existe
  const tableCheck = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'subscribers'
    )`;

  if (!tableCheck[0].exists) {
    console.error('FAIL: tabla subscribers no existe');
    process.exit(1);
  }
  console.log('PASS: tabla subscribers existe');

  // 2. Verificar columnas
  for (const col of REQUIRED_COLUMNS) {
    const colCheck = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'subscribers' AND column_name = ${col.name}`;

    if (colCheck.length === 0) {
      console.error(`FAIL: columna ${col.name} no encontrada`);
      process.exit(1);
    }
    if (colCheck[0].data_type !== col.type) {
      console.error(`FAIL: columna ${col.name} es ${colCheck[0].data_type}, esperado ${col.type}`);
      process.exit(1);
    }
    console.log(`PASS: columna ${col.name} (${col.type})`);
  }

  // 3. Verificar índices
  for (const idx of REQUIRED_INDEXES) {
    const idxCheck = await sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'subscribers' AND indexname = ${idx}`;

    if (idxCheck.length === 0) {
      console.error(`FAIL: índice ${idx} no encontrado`);
      process.exit(1);
    }
    console.log(`PASS: índice ${idx}`);
  }

  console.log('\nTODOS LOS TESTS PASARON');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
