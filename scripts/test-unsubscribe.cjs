// scripts/test-unsubscribe.js
// Test de integración: GET /api/unsubscribe?token=xxx
// Ejecutar: node scripts/test-unsubscribe.js
// Salida esperada (Fase B): ROJO — placeholder no valida ni procesa

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

(async () => {
  const { default: handler } = await import('../api/unsubscribe.js');

  let passed = 0;
  let failed = 0;

  function mockRes() {
    const res = {
      _status: 200,
      _body: '',
      _headers: {},
      status(code) { this._status = code; return this; },
      setHeader(key, val) { this._headers[key] = val; return this; },
      send(body) { this._body = body; return this; },
    };
    return res;
  }

  async function test(name, req, expectStatus, expectContains) {
    const res = mockRes();
    await handler(req, res);
    const ok = res._status === expectStatus
      && (!expectContains || res._body.includes(expectContains));
    if (ok) {
      console.log(`PASS: ${name}`);
      passed++;
    } else {
      const preview = res._body.substring(0, 80);
      console.error(`FAIL: ${name} — esperado ${expectStatus} conteniendo "${expectContains}", recibido ${res._status}: "${preview}"`);
      failed++;
    }
  }

  // 1. Sin token → 400
  await test('GET sin token', { method: 'GET', url: '/api/unsubscribe' }, 400, 'inválida');

  // 2. Token no encontrado → 404
  await test('GET token inexistente', { method: 'GET', url: '/api/unsubscribe?token=00000000-0000-0000-0000-000000000000' }, 404, 'válido');

  // 3. Insertar suscriptor de prueba y darlo de baja
  const sql = neon(process.env.DATABASE_URL);
  const TEST_TOKEN = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  // Limpiar por si existe de un test anterior
  await sql`DELETE FROM subscribers WHERE unsubscribe_token = ${TEST_TOKEN}`;

  // Insertar suscriptor con token conocido
  await sql`
    INSERT INTO subscribers (email, unsubscribe_token)
    VALUES ('unsub-test@example.com', ${TEST_TOKEN})
  `;
  console.log('(suscriptor de prueba insertado)');

  // 3a. Dar de baja → 200
  await test('GET token válido', { method: 'GET', url: `/api/unsubscribe?token=${TEST_TOKEN}` }, 200, 'baja');

  // 3b. Idempotente → 200 con "Ya estás"
  await test('GET token ya usado (idempotente)', { method: 'GET', url: `/api/unsubscribe?token=${TEST_TOKEN}` }, 200, 'Ya estás');

  // Limpiar
  await sql`DELETE FROM subscribers WHERE email = 'unsub-test@example.com'`;

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
