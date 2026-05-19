// scripts/test-subscribe.js
// Test de integración: POST /api/subscribe
// Ejecutar: node scripts/test-subscribe.js
// Salida esperada (Fase B): ROJO — placeholder no valida ni procesa

require('dotenv').config({ path: '.env.local' });

(async () => {
  const { default: handler } = await import('../api/subscribe.js');

  let passed = 0;
  let failed = 0;

  function mockRes() {
    const res = {
      _status: 200,
      _json: null,
      status(code) { this._status = code; return this; },
      json(data) { this._json = data; return this; },
    };
    return res;
  }

  async function test(name, req, expectStatus, expectKey) {
    const res = mockRes();
    await handler(req, res);
    const ok = res._status === expectStatus && (!expectKey || (res._json && expectKey in res._json));
    if (ok) {
      console.log(`PASS: ${name}`);
      passed++;
    } else {
      console.error(`FAIL: ${name} — esperado ${expectStatus} con key "${expectKey}", recibido ${res._status} con`, res._json);
      failed++;
    }
  }

  // 1. Método no permitido
  await test('GET rechazado', { method: 'GET' }, 405, 'error');

  // 2. Email faltante
  await test('POST sin body', { method: 'POST', body: {} }, 400, 'error');

  // 3. Email inválido
  await test('POST email inválido', { method: 'POST', body: { email: 'no-es-email' } }, 400, 'error');

  // 4. Email válido
  await test('POST email válido', { method: 'POST', body: { email: 'test@example.com' } }, 200, 'ok');

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
