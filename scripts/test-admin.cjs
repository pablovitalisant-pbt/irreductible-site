// scripts/test-admin.cjs
// Test de integración: GET /api/admin (panel protegido con Basic Auth)
// Ejecutar: node scripts/test-admin.cjs
// Salida esperada (Fase B): ROJO — módulo no existe

require('dotenv').config({ path: '.env.local' });

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
    const mod = await import('../api/admin.js');
    handler = mod.default;
    check('Módulo api/admin.js existe', true);
  } catch {
    check('Módulo api/admin.js existe', false);
    console.log(`\n${passed} pasaron, ${failed} fallaron`);
    process.exit(1);
  }

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password';

  function mockReq({ headers = {} } = {}) {
    return { method: 'GET', headers };
  }

  function mockRes() {
    return {
      _status: 200, _body: '', _headers: {},
      status(code) { this._status = code; return this; },
      setHeader(key, val) { this._headers[key] = val; return this; },
      send(body) { this._body = body; return this; },
    };
  }

  // 1. Sin auth → 401 + WWW-Authenticate
  const res1 = mockRes();
  await handler(mockReq(), res1);
  check('GET sin auth → 401', res1._status === 401);
  check('WWW-Authenticate header presente', res1._headers['WWW-Authenticate'] != null);

  // 2. Auth incorrecta → 401
  const res2 = mockRes();
  const badAuth = 'Basic ' + Buffer.from('admin:wrongpassword').toString('base64');
  await handler(mockReq({ headers: { authorization: badAuth } }), res2);
  check('GET auth incorrecta → 401', res2._status === 401);

  // 3. Auth correcta → 200 con tabla HTML
  const res3 = mockRes();
  const goodAuth = 'Basic ' + Buffer.from(`admin:${ADMIN_PASSWORD}`).toString('base64');
  await handler(mockReq({ headers: { authorization: goodAuth } }), res3);
  check('GET auth correcta → 200', res3._status === 200);
  check('HTML contiene tabla de suscriptores', res3._body.includes('<table') && res3._body.includes('Email'));

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
