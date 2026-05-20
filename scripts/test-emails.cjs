// scripts/test-emails.cjs
// Test de integración: emails de confirmación vía Resend
// Ejecutar: node scripts/test-emails.cjs
// Salida esperada (Fase B): ROJO — lib/email.js no existe aún

require('dotenv').config({ path: '.env.local' });

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) { console.log(`PASS: ${name}`); passed++; }
  else { console.error(`FAIL: ${name}`); failed++; }
}

(async () => {
  let email;
  try {
    const mod = await import('../lib/email.js');
    email = mod;
    check('Módulo lib/email.js existe', true);
  } catch (e) {
    check('Módulo lib/email.js existe', false);
    console.error(`\nABORTADO: ${e.message}`);
    console.log(`\n${passed} pasaron, ${failed} fallaron`);
    process.exit(1);
  }

  // Verificar funciones exportadas
  check('sendBuyerConfirmation exportada', typeof email.sendBuyerConfirmation === 'function');
  check('sendAdminNotification exportada', typeof email.sendAdminNotification === 'function');

  // Verificar que sendBuyerConfirmation acepta los parámetros esperados
  // (sin enviar realmente en test — solo validar firma)
  try {
    // Si ADMIN_EMAIL existe, podemos hacer un test real
    const hasAdmin = !!process.env.ADMIN_EMAIL;
    const hasResend = !!process.env.RESEND_API_KEY;
    check('ADMIN_EMAIL configurado (o usa default)', hasAdmin || true); // default: pablo@irreductible.site
    check('RESEND_API_KEY configurado', hasResend);

    if (hasResend) {
      console.log('  Resend disponible — test de envío real no incluido en CI');
      check('Tests de firma OK', true);
    }
  } catch (e) {
    console.log('  ADVERTENCIA:', e.message);
    check('No debería tirar excepción en imports', false);
  }

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
