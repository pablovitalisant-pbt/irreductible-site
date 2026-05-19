// scripts/test-modal.js
// Smoke test: valida que index.html tenga el modal y los data-attributes
// Ejecutar: node scripts/test-modal.js
// Salida esperada (Fase B): ROJO — modal no existe, botones sin data-action

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) { console.log(`PASS: ${name}`); passed++; }
  else { console.error(`FAIL: ${name}`); failed++; }
}

// 1. Botones con data-action (deben ser 2: Hero + CTA final)
const ctaButtons = (html.match(/data-action="open-subscribe-modal"/g) || []);
check('Dos botones con data-action="open-subscribe-modal"', ctaButtons.length === 2);

// 2. Modal existe
check('Modal #subscribe-modal existe', html.includes('id="subscribe-modal"'));

// 3. Sin links residuales a Systeme.io
const systemeLinks = (html.match(/systeme\.io/g) || []);
check('Sin links a Systeme.io', systemeLinks.length === 0);

// 4. Input email existe
check('Input email en el modal', html.includes('type="email"'));

// 5. Modal y script inline existen
check('Modal y script inline (subscribe-modal)', html.includes('subscribe-modal'));

console.log(`\n${passed} pasaron, ${failed} fallaron`);
if (failed > 0) process.exit(1);
