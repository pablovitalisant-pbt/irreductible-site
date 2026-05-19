// scripts/test-webhooks.cjs
// Test de integración: POST /api/webhooks/resend
// Ejecutar: node scripts/test-webhooks.cjs
// Salida esperada (Fase B): ROJO — endpoint no existe

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) { console.log(`PASS: ${name}`); passed++; }
  else { console.error(`FAIL: ${name}`); failed++; }
}

(async () => {
  // Verificar que el módulo existe
  let handler;
  try {
    const mod = await import('../api/webhooks/resend.js');
    handler = mod.default;
    check('Módulo api/webhooks/resend.js existe', true);
  } catch {
    check('Módulo api/webhooks/resend.js existe', false);
    console.log(`\n${passed} pasaron, ${failed} fallaron`);
    process.exit(1);
  }

  // Verificar columnas de métricas en subscribers
  const sql = neon(process.env.DATABASE_URL);
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'subscribers' AND column_name IN ('opens', 'clicks', 'unsubscribed_reason')
  `;
  check('Columna opens existe', cols.some(c => c.column_name === 'opens'));
  check('Columna clicks existe', cols.some(c => c.column_name === 'clicks'));
  check('Columna unsubscribed_reason existe', cols.some(c => c.column_name === 'unsubscribed_reason'));

  // Preparar suscriptor de prueba
  const TEST_EMAIL = 'webhook-test@example.com';
  const TEST_TOKEN = '00000000-0000-0000-0000-000000000001';

  await sql`DELETE FROM subscribers WHERE email = ${TEST_EMAIL}`;
  await sql`
    INSERT INTO subscribers (email, unsubscribe_token, status)
    VALUES (${TEST_EMAIL}, ${TEST_TOKEN}, 'active')
  `;

  function mockReq(body) {
    return {
      method: 'POST',
      headers: { 'svix-id': 'test-' + Date.now() },
      body,
    };
  }

  function mockRes() {
    return {
      _status: 200, _json: null,
      status(code) { this._status = code; return this; },
      json(data) { this._json = data; return this; },
    };
  }

  // Test: evento bounced → baja automática
  const resBounced = mockRes();
  await handler(mockReq({
    type: 'email.bounced',
    data: { to: TEST_EMAIL },
  }), resBounced);
  check('Bounced → 200', resBounced._status === 200);

  const subAfterBounce = await sql`SELECT status, unsubscribed_reason FROM subscribers WHERE email = ${TEST_EMAIL}`;
  check('Status = unsubscribed tras bounced', subAfterBounce[0]?.status === 'unsubscribed');
  check('Razón = bounced', subAfterBounce[0]?.unsubscribed_reason === 'bounced');

  // Reactivar y probar complaint
  await sql`UPDATE subscribers SET status = 'active', unsubscribed_reason = NULL WHERE email = ${TEST_EMAIL}`;
  const resComplained = mockRes();
  await handler(mockReq({
    type: 'email.complained',
    data: { to: TEST_EMAIL },
  }), resComplained);
  check('Complained → 200', resComplained._status === 200);

  const subAfterComplaint = await sql`SELECT status, unsubscribed_reason FROM subscribers WHERE email = ${TEST_EMAIL}`;
  check('Status = unsubscribed tras complaint', subAfterComplaint[0]?.status === 'unsubscribed');
  check('Razón = complained', subAfterComplaint[0]?.unsubscribed_reason === 'complained');

  // Reactivar y probar opened → incrementa contador
  await sql`UPDATE subscribers SET status = 'active', unsubscribed_reason = NULL, opens = 0 WHERE email = ${TEST_EMAIL}`;
  await handler(mockReq({ type: 'email.opened', data: { to: TEST_EMAIL } }), mockRes());
  const subAfterOpen = await sql`SELECT opens FROM subscribers WHERE email = ${TEST_EMAIL}`;
  check('Opens incrementado', subAfterOpen[0]?.opens >= 1);

  // Reactivar y probar clicked → incrementa contador
  await sql`UPDATE subscribers SET status = 'active', unsubscribed_reason = NULL, clicks = 0 WHERE email = ${TEST_EMAIL}`;
  await handler(mockReq({ type: 'email.clicked', data: { to: TEST_EMAIL } }), mockRes());
  const subAfterClick = await sql`SELECT clicks FROM subscribers WHERE email = ${TEST_EMAIL}`;
  check('Clicks incrementado', subAfterClick[0]?.clicks >= 1);

  // Evento sin email → 400
  const resNoEmail = mockRes();
  await handler(mockReq({ type: 'email.opened', data: {} }), resNoEmail);
  check('Evento sin email → 400', resNoEmail._status === 400);

  // Limpiar
  await sql`DELETE FROM subscribers WHERE email = ${TEST_EMAIL}`;

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
