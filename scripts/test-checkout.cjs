// scripts/test-checkout.cjs
// Test de integración: checkout.html — validación de formulario
// Ejecutar: node scripts/test-checkout.cjs
// Salida esperada (Fase B): ROJO — checkout.html no existe aún

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) { console.log(`PASS: ${name}`); passed++; }
  else { console.error(`FAIL: ${name}`); failed++; }
}

// ── 1. Archivo existe ──────────────────────────────────────────
const htmlPath = path.join(__dirname, '..', 'checkout.html');
const fileExists = fs.existsSync(htmlPath);
check('checkout.html existe en raíz del proyecto', fileExists);

if (!fileExists) {
  console.error('\nABORTADO: checkout.html no encontrado. Implementar en Fase C.');
  console.log(`\n${passed} pasaron, ${failed} fallaron`);
  process.exit(1);
}

// ── 2. Estructura del formulario ────────────────────────────────
const html = fs.readFileSync(htmlPath, 'utf-8');

const requiredFields = [
  'quantity', 'buyer_name', 'buyer_email',
  'address_line1', 'city', 'country',
  'postal_code', 'phone', 'shipping_option'
];

for (const field of requiredFields) {
  const hasField = html.includes(`name="${field}"`) || html.includes(`id="${field}"`);
  check(`Campo requerido presente: ${field}`, hasField);
}

// ── 3. Validación de email ──────────────────────────────────────
const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
check('Regex de email en el HTML', emailRegex.test('test@example.com') && !emailRegex.test('no-es-email'));

// ── 4. Elementos esperados ──────────────────────────────────────
check('Contiene <form>', /<form/i.test(html));
check('Contiene botón de submit', /submit/i.test(html));
check('Contiene selector de país', /country/i.test(html) && /select/i.test(html));
check('Tailwind CDN presente', html.includes('tailwindcss'));

// ── 5. Sin código roto ──────────────────────────────────────────
check('HTML empieza con DOCTYPE', /<!DOCTYPE html/i.test(html.trimStart()));
check('HTML contiene </html>', html.includes('</html>'));

// ── 6. Lógica de validación JS presente ─────────────────────────
check('Función validate() presente', html.includes('function validate()'));
check('Array REQUIRED presente', html.includes('const REQUIRED'));
check('EMAIL_RE definido', html.includes('EMAIL_RE'));
check('SHIPPING_MOCK definido', html.includes('SHIPPING_MOCK'));
check('Maneja país US en shipping', /US:\s*\[/.test(html));
check('Handler submit con preventDefault', html.includes('e.preventDefault()'));
check('Handler change en country', html.includes("countrySelect.addEventListener('change'"));
check('Doble submit prevenido (var submitting)', html.includes('submitting'));

console.log(`\n${passed} pasaron, ${failed} fallaron`);
if (failed > 0) process.exit(1);
