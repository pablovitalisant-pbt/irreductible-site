// scripts/test-send-newsletter.js
// Test de integración: POST /api/send-newsletter
// Ejecutar: node scripts/test-send-newsletter.js
// Salida esperada (Fase B): ROJO — placeholder no valida ni procesa

require('dotenv').config({ path: '.env.local' });

(async () => {
  const { default: handler } = await import('../api/send-newsletter.js');

  let passed = 0;
  let failed = 0;

  function mockReq({ method = 'POST', headers = {}, body } = {}) {
    return { method, headers, body };
  }

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
    const ok = res._status === expectStatus
      && (!expectKey || (res._json && expectKey in res._json));
    if (ok) {
      console.log(`PASS: ${name}`);
      passed++;
    } else {
      console.error(`FAIL: ${name} — esperado ${expectStatus} con key "${expectKey}", recibido ${res._status} con`, res._json);
      failed++;
    }
  }

  const API_KEY = process.env.NEWSLETTER_API_KEY;
  const validBody = { subject: 'Test', html: '<p>Hola</p>', text: 'Hola' };

  // 1. Método no permitido
  await test('GET rechazado', mockReq({ method: 'GET' }), 405, 'error');

  // 2. Sin API key
  await test('POST sin x-api-key', mockReq({ body: validBody }), 401, 'error');

  // 3. API key incorrecta
  await test('POST API key incorrecta', mockReq({ headers: { 'x-api-key': 'wrong-key' }, body: validBody }), 401, 'error');

  // 4. Campos faltantes
  await test('POST sin subject', mockReq({ headers: { 'x-api-key': API_KEY }, body: { html: '<p>', text: 'x' } }), 400, 'error');

  // 5. Válido (placeholder dará 200 pero sin sent/failed)
  await test('POST válido', mockReq({ headers: { 'x-api-key': API_KEY }, body: validBody }), 200, 'sent');

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
