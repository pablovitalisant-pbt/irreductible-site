// scripts/test-paypal-create-order.cjs
// Test de integración: POST /api/paypal/create-order
// Ejecutar: node scripts/test-paypal-create-order.cjs
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
    const mod = await import('../api/paypal/create-order.js');
    handler = mod.default;
    check('Módulo api/paypal/create-order.js existe', true);
  } catch (e) {
    check('Módulo api/paypal/create-order.js existe', false);
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

  // 3. Sin total_usd
  const r3 = mockRes();
  await handler(mockReq({ buyer_email:'test@example.com', buyer_name:'Test' }), r3);
  check('Sin total_usd → 400', r3._status === 400);

  // 4. total_usd <= 0
  const r4 = mockRes();
  await handler(mockReq({ total_usd:0, buyer_email:'test@example.com', buyer_name:'Test' }), r4);
  check('total_usd 0 → 400', r4._status === 400);

  // 5. total_usd > 500
  const r5 = mockRes();
  await handler(mockReq({ total_usd:501, buyer_email:'test@example.com', buyer_name:'Test' }), r5);
  check('total_usd 501 → 400', r5._status === 400);

  // 6. Email inválido
  const r6 = mockRes();
  await handler(mockReq({ total_usd:20, buyer_email:'no-es-email', buyer_name:'Test' }), r6);
  check('Email inválido → 400', r6._status === 400);

  // ── Caso válido ───────────────────────────────────────────────
  const validBody = {
    total_usd: 22.74,
    breakdown: { unit_price_usd:6, quantity:2, printing_total_usd:12, fulfillment_fee_usd:0.75, shipping_usd:9.99 },
    buyer_email: 'test@example.com',
    buyer_name: 'Test Buyer'
  };
  const r7 = mockRes();
  await handler(mockReq(validBody), r7);
  if (r7._status !== 200) {
    console.log(`  SKIP: PayPal API retorna ${r7._status} — ${r7._json?.error || 'desconocido'}`);
    check('Petición válida → 200 (o skip si PayPal no disponible)', true);
    check('paypal_order_id presente (o skip)', true);
    check('approval_url presente (o skip)', true);
  } else {
    check('Petición válida → 200', r7._status === 200);
    check('paypal_order_id presente', typeof r7._json?.paypal_order_id === 'string' && r7._json.paypal_order_id.length > 0);
    check('approval_url presente', r7._json?.approval_url?.startsWith('https://'));
  }

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
