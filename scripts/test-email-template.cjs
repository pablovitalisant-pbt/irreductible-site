// scripts/test-email-template.cjs
// Test de integración: editor de email de bienvenida en panel admin
// Ejecutar: node scripts/test-email-template.cjs
// Salida esperada (Fase B): ROJO — schema y endpoints no existen

require('dotenv').config({ path: '.env.local' });

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) { console.log(`PASS: ${name}`); passed++; }
  else { console.error(`FAIL: ${name}`); failed++; }
}

(async () => {
  // === Schema ===
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);

  const tableCheck = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'email_templates'
    )`;
  check('Tabla email_templates existe', tableCheck[0].exists);

  const colCheck = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'email_templates'
    ORDER BY ordinal_position
  `;
  const colNames = colCheck.map(c => c.column_name);
  check('Columnas: name, subject, html, updated_at',
    colNames.includes('name') && colNames.includes('subject') &&
    colNames.includes('html') && colNames.includes('updated_at'));

  // Seed row para lead_magnet
  const seedRow = await sql`SELECT * FROM email_templates WHERE name = 'lead_magnet'`;
  check('Template seed lead_magnet existe', seedRow.length === 1);

  // === API: POST guardar template ===
  const { default: handler } = await import('../api/admin.js');

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password';
  const authHeader = 'Basic ' + Buffer.from(`admin:${ADMIN_PASSWORD}`).toString('base64');

  function mockReq({ method = 'GET', headers = {}, body } = {}) {
    return { method, headers, body };
  }

  function mockRes() {
    return {
      _status: 200, _json: null, _body: '', _headers: {},
      status(code) { this._status = code; return this; },
      json(data) { this._json = data; return this; },
      setHeader(key, val) { this._headers[key] = val; return this; },
      send(body) { this._body = body; return this; },
    };
  }

  // POST sin auth → 401
  const res1 = mockRes();
  await handler(mockReq({ method: 'POST', body: { name: 'lead_magnet', subject: 'Test', html: '<p>x</p>' } }), res1);
  check('POST template sin auth → 401', res1._status === 401);

  // POST con auth → 200
  const res2 = mockRes();
  await handler(mockReq({
    method: 'POST',
    headers: { authorization: authHeader },
    body: { name: 'lead_magnet', subject: 'Nuevo asunto', html: '<p>Nuevo HTML</p>' },
  }), res2);
  check('POST template con auth → 200', res2._status === 200 && res2._json?.ok);

  // POST sin campos requeridos → 400
  const res3 = mockRes();
  await handler(mockReq({
    method: 'POST',
    headers: { authorization: authHeader },
    body: { name: 'lead_magnet' },
  }), res3);
  check('POST template sin subject/html → 400', res3._status === 400);

  // GET contiene formulario editor
  const res4 = mockRes();
  await handler(mockReq({ method: 'GET', headers: { authorization: authHeader } }), res4);
  check('GET admin contiene formulario editor', res4._body.includes('subject') && res4._body.includes('textarea'));

  // === subscribe.js usa template de DB ===
  const subMod = await import('../api/subscribe.js');
  check('getLeadMagnetTemplate exportada', typeof subMod.getLeadMagnetTemplate === 'function');

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
