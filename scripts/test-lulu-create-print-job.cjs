// scripts/test-lulu-create-print-job.cjs
// Test de integración: POST /api/lulu/create-print-job
// Ejecutar: node scripts/test-lulu-create-print-job.cjs
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
    const mod = await import('../api/lulu/create-print-job.js');
    handler = mod.default;
    check('Módulo api/lulu/create-print-job.js existe', true);
  } catch (e) {
    check('Módulo api/lulu/create-print-job.js existe', false);
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

  // 3. Sin shipping_address
  const r3 = mockRes();
  await handler(mockReq({ quantity:1, buyer_email:'t@t.com', shipping_option:'us_mail' }), r3);
  check('Sin shipping_address → 400', r3._status === 400);

  // 4. Sin quantity
  const r4 = mockRes();
  await handler(mockReq({ shipping_address:{country:'US'}, buyer_email:'t@t.com' }), r4);
  check('Sin quantity → 400', r4._status === 400);

  // 5. Quantity > 10
  const r5 = mockRes();
  await handler(mockReq({ quantity:11, buyer_email:'t@t.com', shipping_address:{country:'US'}, shipping_option:'us_mail', buyer_name:'T' }), r5);
  check('Quantity > 10 → 400', r5._status === 400);

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
