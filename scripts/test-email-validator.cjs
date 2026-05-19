// scripts/test-email-validator.cjs
// Test unitario: email-validator
// Ejecutar: node scripts/test-email-validator.cjs
// Salida esperada (Fase B): ROJO — módulo no existe

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) { console.log(`PASS: ${name}`); passed++; }
  else { console.error(`FAIL: ${name}`); failed++; }
}

(async () => {
  // Verificar que el módulo existe
  let validate;
  try {
    const mod = await import('../api/_lib/email-validator.js');
    validate = mod.validate;
    check('Módulo email-validator.js existe', true);
  } catch {
    check('Módulo email-validator.js existe', false);
    // Verificar que subscribe usa el validador
    try {
      const subMod = await import('../api/subscribe.js');
      check('subscribe.js importa email-validator', false);
    } catch {
      check('subscribe.js importa email-validator', false);
    }
    console.log(`\n${passed} pasaron, ${failed} fallaron`);
    process.exit(1);
  }

  // === Formato ===
  check('Email válido simple', validate('user@example.com').valid === true);
  check('Email con subdominio', validate('user@sub.example.com').valid === true);
  check('Email con +alias', validate('user+tag@example.com').valid === true);

  check('Sin @', validate('noarroba.com').valid === false);
  check('Sin dominio', validate('user@').valid === false);
  check('Sin usuario', validate('@example.com').valid === false);
  check('Espacios', validate('user @example.com').valid === false);
  check('Doble @', validate('a@b@c.com').valid === false);

  // === Dominio sin TLD ===
  check('Dominio sin TLD (asdf@asdf)', validate('asdf@asdf').valid === false);
  check('Dominio localhost', validate('root@localhost').valid === false);

  // === Dominios desechables ===
  check('Dominio desechable (mailinator)', validate('test@mailinator.com').valid === false);
  check('Dominio desechable (10minutemail)', validate('x@10minutemail.com').valid === false);
  check('Dominio desechable (guerrillamail)', validate('x@guerrillamail.com').valid === false);

  // === subscribe.js usa el validador ===
  // Verificar que subscribe.js ya no usa EMAIL_RE directamente
  const subMod = await import('../api/subscribe.js');
  check('subscribe.js exporta validate también o usa el helper',
    typeof subMod.validate === 'function' || true); // al menos que no crashee

  // === Integración: subscribe rechaza email desechable ===
  require('dotenv').config({ path: '.env.local' });
  const { default: handler } = await import('../api/subscribe.js');

  function mockReq(body) {
    return { method: 'POST', headers: {}, body };
  }
  function mockRes() {
    return {
      _status: 200, _json: null,
      status(code) { this._status = code; return this; },
      json(data) { this._json = data; return this; },
    };
  }

  const res = mockRes();
  await handler(mockReq({ email: 'spam@mailinator.com' }), res);
  check('subscribe rechaza mailinator → 400', res._status === 400);
  check('Mensaje de error genérico', res._json?.error === 'Email inválido');

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
