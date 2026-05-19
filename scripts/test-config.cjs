// scripts/test-config.js
// Smoke test: valida que vercel.json tenga CORS configurado
// Ejecutar: node scripts/test-config.js
// Salida esperada (Fase B): ERROR — headers CORS no configurados

const fs = require('fs');
const path = require('path');

const vercelPath = path.join(__dirname, '..', 'vercel.json');
if (!fs.existsSync(vercelPath)) {
  console.error('FAIL: vercel.json no existe');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));

if (!config.headers || config.headers.length === 0) {
  console.error('FAIL: vercel.json no tiene headers CORS configurados');
  process.exit(1);
}

const apiRoute = config.headers.find(h =>
  h.source && h.source.includes('/api')
);

if (!apiRoute) {
  console.error('FAIL: no hay regla CORS para /api/*');
  process.exit(1);
}

const corsHeaders = apiRoute.headers || [];
const hasOrigin = corsHeaders.some(h => h.key === 'Access-Control-Allow-Origin');
const hasMethods = corsHeaders.some(h => h.key === 'Access-Control-Allow-Methods');

if (!hasOrigin || !hasMethods) {
  console.error('FAIL: headers CORS incompletos (falta Allow-Origin o Allow-Methods)');
  process.exit(1);
}

console.log('PASS: CORS configurado correctamente para /api/*');
