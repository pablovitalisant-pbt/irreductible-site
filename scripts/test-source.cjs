// scripts/test-source.cjs
// Smoke + integración: parámetro source en subscribe y admin
// Ejecutar: node scripts/test-source.cjs
// Salida esperada (Fase B): ROJO — columna source no existe

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) { console.log(`PASS: ${name}`); passed++; }
  else { console.error(`FAIL: ${name}`); failed++; }
}

(async () => {
  // === Schema ===
  const sql = neon(process.env.DATABASE_URL);
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'subscribers' AND column_name = 'source'
  `;
  check('Columna source existe en subscribers', cols.length === 1);

  // === subscribe.js guarda source ===
  const { default: handler } = await import('../api/subscribe.js');

  function mockReq(body) {
    return { method: 'POST', headers: {}, body };
  }

  function mockRes() {
    return {
      _status: 200, _json: null,
      status(code) { this._status = code; return this; },
      json(data) { this._json = data; return this; },
    };
  }

  const TEST_EMAIL = 'source-test@example.com';
  await sql`DELETE FROM subscribers WHERE email = ${TEST_EMAIL}`;

  const res = mockRes();
  await handler(mockReq({ email: TEST_EMAIL, source: 'instagram_bio' }), res);
  check('Subscribe con source → 200', res._status === 200);

  const row = await sql`SELECT source FROM subscribers WHERE email = ${TEST_EMAIL}`;
  check('Source guardado = instagram_bio', row[0]?.source === 'instagram_bio');

  // Source truncado a 50 chars
  const longSource = 'a'.repeat(60);
  const TEST_EMAIL2 = 'source-test2@example.com';
  await sql`DELETE FROM subscribers WHERE email = ${TEST_EMAIL2}`;

  await handler(mockReq({ email: TEST_EMAIL2, source: longSource }), mockRes());
  const row2 = await sql`SELECT source FROM subscribers WHERE email = ${TEST_EMAIL2}`;
  check('Source truncado a 50 chars', row2[0]?.source?.length === 50);

  // Sin source → NULL o vacío
  const TEST_EMAIL3 = 'source-test3@example.com';
  await sql`DELETE FROM subscribers WHERE email = ${TEST_EMAIL3}`;

  await handler(mockReq({ email: TEST_EMAIL3 }), mockRes());
  const row3 = await sql`SELECT source FROM subscribers WHERE email = ${TEST_EMAIL3}`;
  check('Sin source → NULL o empty', !row3[0]?.source);

  // === index.html tiene campo oculto ===
  const fs = require('fs');
  const html = fs.readFileSync('index.html', 'utf-8');
  check('index.html tiene input[name="source"]', html.includes('name="source"'));

  // === admin.js muestra Source ===
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password';
  const authHeader = 'Basic ' + Buffer.from(`admin:${ADMIN_PASSWORD}`).toString('base64');

  const { default: adminHandler } = await import('../api/admin.js');
  const adminRes = { _status: 200, _body: '', _headers: {}, status(c) { this._status = c; return this; }, setHeader(k, v) { this._headers[k] = v; return this; }, send(b) { this._body = b; return this; } };
  await adminHandler({ method: 'GET', headers: { authorization: authHeader } }, adminRes);
  check('Admin panel muestra columna Source', adminRes._body.includes('<th>Source</th>'));

  // Limpiar
  await sql`DELETE FROM subscribers WHERE email IN (${TEST_EMAIL}, ${TEST_EMAIL2}, ${TEST_EMAIL3})`;

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
