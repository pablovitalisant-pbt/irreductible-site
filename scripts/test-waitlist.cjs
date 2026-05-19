// scripts/test-waitlist.cjs
// Test de integración: POST /api/waitlist + tags
// Ejecutar: node scripts/test-waitlist.cjs
// Salida esperada (Fase B): ROJO — endpoint y schema no existen

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) { console.log(`PASS: ${name}`); passed++; }
  else { console.error(`FAIL: ${name}`); failed++; }
}

(async () => {
  const sql = neon(process.env.DATABASE_URL);

  // === Schema ===
  const tagCol = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'subscribers' AND column_name = 'tags'
  `;
  check('Columna tags existe en subscribers', tagCol.length === 1);

  // === Seed template waitlist ===
  const seedRow = await sql`SELECT name FROM email_templates WHERE name = 'waitlist'`;
  check('Template seed waitlist existe', seedRow.length === 1);

  // === subscribe.js: tags por defecto ===
  const { default: subHandler } = await import('../api/subscribe.js');
  check('subscribe.js importado', true);

  const TEST_EMAIL = 'waitlist-new@example.com';
  const TEST_EMAIL2 = 'waitlist-existing@example.com';
  await sql`DELETE FROM subscribers WHERE email IN (${TEST_EMAIL}, ${TEST_EMAIL2})`;

  function mockReq(body) { return { method: 'POST', headers: {}, body }; }
  function mockRes() {
    return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(d) { this._json = d; return this; } };
  }

  // Verificar que subscribe guarda tags = '{lead_magnet}' por defecto
  const resSub = mockRes();
  await subHandler(mockReq({ email: TEST_EMAIL }), resSub);
  const subRow = await sql`SELECT tags FROM subscribers WHERE email = ${TEST_EMAIL}`;
  check('subscribe guarda tags = {lead_magnet}', subRow[0]?.tags?.[0] === 'lead_magnet');

  // === POST /api/waitlist ===
  let waitlistHandler;
  try {
    const mod = await import('../api/waitlist.js');
    waitlistHandler = mod.default;
    check('Módulo api/waitlist.js existe', true);
  } catch {
    check('Módulo api/waitlist.js existe', false);
    console.log(`\n${passed} pasaron, ${failed} fallaron`);
    process.exit(1);
  }

  // 1. Email nuevo → INSERT con tags
  const res1 = mockRes();
  await waitlistHandler(mockReq({ email: TEST_EMAIL2 }), res1);
  check('Waitlist email nuevo → 200', res1._status === 200 && res1._json?.ok);
  const row2 = await sql`SELECT source, tags FROM subscribers WHERE email = ${TEST_EMAIL2}`;
  check('Waitlist: source = lista_espera_libro', row2[0]?.source === 'lista_espera_libro');
  check('Waitlist: tags incluye lista_espera_libro', row2[0]?.tags?.includes('lista_espera_libro'));

  // 2. Email existente → UPDATE agrega tag
  const res2 = mockRes();
  await waitlistHandler(mockReq({ email: TEST_EMAIL }), res2);
  check('Waitlist email existente → 200', res2._status === 200 && res2._json?.ok);
  const row1 = await sql`SELECT tags FROM subscribers WHERE email = ${TEST_EMAIL}`;
  check('Waitlist: tags incluye lista_espera_libro + lead_magnet',
    row1[0]?.tags?.includes('lead_magnet') && row1[0]?.tags?.includes('lista_espera_libro'));

  // 3. Email inválido → 400
  const res3 = mockRes();
  await waitlistHandler(mockReq({ email: 'no-es-email' }), res3);
  check('Waitlist email inválido → 400', res3._status === 400);

  // === admin.js muestra Tags ===
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password';
  const authHeader = 'Basic ' + Buffer.from(`admin:${ADMIN_PASSWORD}`).toString('base64');
  const { default: adminHandler } = await import('../api/admin.js');
  const adminRes = { _status: 200, _body: '', _headers: {}, status(c) { this._status = c; return this; }, setHeader(k, v) { this._headers[k] = v; return this; }, send(b) { this._body = b; return this; }, end() { return this; } };
  await adminHandler({ method: 'GET', headers: { authorization: authHeader } }, adminRes);
  check('Admin muestra columna Tags', adminRes._body.includes('<th>Tags</th>'));

  // Limpiar
  await sql`DELETE FROM subscribers WHERE email IN (${TEST_EMAIL}, ${TEST_EMAIL2})`;

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
