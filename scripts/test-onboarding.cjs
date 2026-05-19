// scripts/test-onboarding.cjs
// Test de integración: secuencia de onboarding + CRON endpoint
// Ejecutar: node scripts/test-onboarding.cjs
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
  // === Schema ===
  const sql = neon(process.env.DATABASE_URL);

  // Tabla onboarding_emails
  const tableCheck = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables WHERE table_name = 'onboarding_emails'
    )`;
  check('Tabla onboarding_emails existe', tableCheck[0].exists);

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'onboarding_emails'
  `;
  const colNames = cols.map(c => c.column_name);
  check('Columnas: subject, html, delay_hours, active',
    colNames.includes('subject') && colNames.includes('html') &&
    colNames.includes('delay_hours') && colNames.includes('active'));

  // Columna onboarding_step en subscribers
  const subCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'subscribers' AND column_name = 'onboarding_step'
  `;
  check('Columna onboarding_step en subscribers', subCols.length === 1);

  // === CRON endpoint ===
  const API_KEY = process.env.NEWSLETTER_API_KEY;

  let cronHandler;
  try {
    const mod = await import('../api/cron/send-onboarding.js');
    cronHandler = mod.default;
    check('Módulo api/cron/send-onboarding.js existe', true);
  } catch {
    check('Módulo api/cron/send-onboarding.js existe', false);
    console.log(`\n${passed} pasaron, ${failed} fallaron`);
    process.exit(1);
  }

  function mockReq({ method = 'POST', headers = {}, body } = {}) {
    return { method, headers, body };
  }

  function mockRes() {
    return {
      _status: 200, _json: null,
      status(code) { this._status = code; return this; },
      json(data) { this._json = data; return this; },
    };
  }

  // Sin API key → 401
  const res1 = mockRes();
  await cronHandler(mockReq({ body: {} }), res1);
  check('CRON sin x-api-key → 401', res1._status === 401);

  // Con API key → 200
  const res2 = mockRes();
  await cronHandler(mockReq({ headers: { 'x-api-key': API_KEY } }), res2);
  check('CRON con x-api-key → 200', res2._status === 200 && typeof res2._json?.processed === 'number');

  // === Admin tiene editor de secuencia ===
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password';
  const authHeader = 'Basic ' + Buffer.from(`admin:${ADMIN_PASSWORD}`).toString('base64');

  const { default: adminHandler } = await import('../api/admin.js');
  const adminRes = { _status: 200, _body: '', _headers: {}, status(c) { this._status = c; return this; }, setHeader(k, v) { this._headers[k] = v; return this; }, send(b) { this._body = b; return this; } };
  await adminHandler({ method: 'GET', headers: { authorization: authHeader } }, adminRes);
  check('Admin muestra editor de secuencia', adminRes._body.includes('onboarding_emails') || adminRes._body.includes('SECUENCIA'));

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
