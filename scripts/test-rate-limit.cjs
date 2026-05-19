// scripts/test-rate-limit.cjs
// Test de integración: rate limiting en POST /api/subscribe
// Ejecutar: node scripts/test-rate-limit.cjs
// Salida esperada (Fase B): ROJO — rate limiter no existe

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) { console.log(`PASS: ${name}`); passed++; }
  else { console.error(`FAIL: ${name}`); failed++; }
}

(async () => {
  // === Test unitario del RateLimiter ===
  const { RateLimiter } = await import('../api/_lib/rate-limiter.js');
  check('Módulo rate-limiter.js importado', true);

  const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60000 });
  const ip = '192.168.1.1';

  check('IP 1: permitida (1/3)', limiter.check(ip) === true);
  check('IP 1: permitida (2/3)', limiter.check(ip) === true);
  check('IP 1: permitida (3/3)', limiter.check(ip) === true);
  check('IP 1: bloqueada (4/3)', limiter.check(ip) === false);
  check('IP 1: bloqueada (5/3)', limiter.check(ip) === false);

  const ip2 = '10.0.0.1';
  check('IP 2: permitida (independiente)', limiter.check(ip2) === true);

  // === Test de integración: handler usa rate limiter ===
  const { default: handler } = await import('../api/subscribe.js');

  function mockReq(ip) {
    return {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
      body: { email: 'no-es-email' },  // email inválido → 400 sin tocar DB
    };
  }

  function mockRes() {
    return {
      _status: 200, _json: null,
      status(code) { this._status = code; return this; },
      json(data) { this._json = data; return this; },
    };
  }

  const testIP = '10.99.99.99';

  // 5 llamadas con email inválido → 400 (cuentan para rate limit)
  for (let i = 0; i < 5; i++) {
    const res = mockRes();
    await handler(mockReq(testIP), res);
    check(`Llamada ${i + 1}/5 desde misma IP → 400 (no 429)`, res._status === 400);
  }

  // 6a llamada → 429
  const resBlock = mockRes();
  await handler(mockReq(testIP), resBlock);
  check('6a llamada misma IP → 429', resBlock._status === 429);

  // IP diferente no está bloqueada
  const resOther = mockRes();
  await handler(mockReq('10.88.88.88'), resOther);
  check('IP diferente → 400 (no bloqueada)', resOther._status === 400);

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
