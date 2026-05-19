// scripts/test-waitlist-modal.cjs
// Smoke test: modal waitlist en libro.html
// Ejecutar: node scripts/test-waitlist-modal.cjs
// Salida esperada (Fase B): ROJO — modal y data-action no existen

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'libro.html'), 'utf-8');

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) { console.log(`PASS: ${name}`); passed++; }
  else { console.error(`FAIL: ${name}`); failed++; }
}

// 1. Botones con data-action (nav + hero + final CTA = 3)
const btns = (html.match(/data-action="open-waitlist-modal"/g) || []);
check('3 botones con data-action="open-waitlist-modal"', btns.length === 3);

// 2. Sin links a Systeme.io
const systemeLinks = (html.match(/systeme\.io/g) || []);
check('Sin links a Systeme.io', systemeLinks.length === 0);

// 3. Modal existe
check('Modal #waitlist-modal existe', html.includes('id="waitlist-modal"'));

// 4. Llama a /api/waitlist
check('Fetch a /api/waitlist', html.includes('/api/waitlist'));

// 5. Texto del botón correcto
check('Texto: UNIRME A LA LISTA DE ESPERA', html.includes('UNIRME A LA LISTA DE ESPERA'));

console.log(`\n${passed} pasaron, ${failed} fallaron`);
if (failed > 0) process.exit(1);
