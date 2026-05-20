// scripts/test-paypal-capture-order.cjs
// Test de integración: POST /api/paypal/capture-order
// Ejecutar: node scripts/test-paypal-capture-order.cjs
// Salida esperada (Fase B): ROJO — endpoint no existe aún

require('dotenv').config({ path: '.env.local' });

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) { console.log(`PASS: ${name}`); passed++; }
  else { console.error(`FAIL: ${name}`); failed++; }
}

function mockRes() {
  return { _status:200, _json:null, status(c){ this._status=c; return this; }, json(d){ this._json=d; return this; } };
}

function mockReq(body, method='POST') {
  return { method, headers:{}, body };
}

(async () => {
  let handler;
  try {
    const mod = await import('../api/paypal/capture-order.js');
    handler = mod.default;
    check('Módulo api/paypal/capture-order.js existe', true);
  } catch (e) {
    check('Módulo api/paypal/capture-order.js existe', false);
    console.error(`\nABORTADO: ${e.message}`);
    console.log(`\n${passed} pasaron, ${failed} fallaron`);
    process.exit(1);
  }

  // ── Validación ────────────────────────────────────────────────

  // 1. GET rechazado
  const r1 = mockRes();
  await handler(mockReq(null, 'GET'), r1);
  check('GET → 405', r1._status === 405);

  // 2. Body vacío
  const r2 = mockRes();
  await handler(mockReq({}), r2);
  check('Body vacío → 400', r2._status === 400 && r2._json?.error);

  // 3. paypal_order_id faltante
  const r3 = mockRes();
  await handler(mockReq({ something:'else' }), r3);
  check('Sin paypal_order_id → 400', r3._status === 400);

  // 4. paypal_order_id vacío
  const r4 = mockRes();
  await handler(mockReq({ paypal_order_id:'' }), r4);
  check('paypal_order_id vacío → 400', r4._status === 400);

  // 5. Orden inexistente → 404 o 502
  const r5 = mockRes();
  await handler(mockReq({ paypal_order_id:'INVALID_ID_12345' }), r5);
  check('Orden inválida → error (404/502)', r5._status >= 400);

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
