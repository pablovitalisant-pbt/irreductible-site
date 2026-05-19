// scripts/test-unsubscribe-link.cjs
// Smoke test: link de baja personalizado en todos los emails
// Ejecutar: node scripts/test-unsubscribe-link.cjs
// Salida esperada (Fase B): ROJO — lead magnet no incluye token personalizado

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) { console.log(`PASS: ${name}`); passed++; }
  else { console.error(`FAIL: ${name}`); failed++; }
}

// Test del lead magnet email (subscribe.js)
// La funcion leadMagnetEmail debe aceptar un token y generar link con el
(async () => {
  const mod = await import('../api/subscribe.js');

  // 1. La función leadMagnetEmail debe ser exportada y aceptar token
  check('leadMagnetEmail es exportada', typeof mod.leadMagnetEmail === 'function');

  if (typeof mod.leadMagnetEmail === 'function') {
    const html = mod.leadMagnetEmail(
      'https://example.com/lead.pdf',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'https://irreductible.site'
    );

    // 2. El HTML contiene el token en el link de baja
    check('Email contiene token en link de baja',
      html.includes('/api/unsubscribe?token=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'));

    // 3. El HTML NO contiene link sin token
    check('Email NO contiene /api/unsubscribe sin token',
      !html.includes('/api/unsubscribe"') && !html.includes("/api/unsubscribe'"));
  }

  // Test del newsletter footer (send-newsletter.js)
  const mod2 = await import('../api/send-newsletter.js');

  // 4. unsubscribeFooter es exportada
  check('unsubscribeFooter es exportada', typeof mod2.unsubscribeFooter === 'function');

  if (typeof mod2.unsubscribeFooter === 'function') {
    const footer = mod2.unsubscribeFooter('11111111-2222-3333-4444-555555555555');

    // 5. Footer HTML contiene token
    check('Footer HTML contiene token en link de baja',
      footer.html.includes('/api/unsubscribe?token=11111111-2222-3333-4444-555555555555'));

    // 6. Footer text contiene token
    check('Footer text contiene token en link de baja',
      footer.text.includes('/api/unsubscribe?token=11111111-2222-3333-4444-555555555555'));
  }

  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  if (failed > 0) process.exit(1);
})();
