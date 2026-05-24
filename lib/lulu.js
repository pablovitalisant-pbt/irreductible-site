// lib/lulu.js
// Cliente Lulu Print API — server-side only
// Autenticación OAuth2 + cálculo de costos con constantes (el print job real va en SLICE-05)

import { BOOK_SKU, BOOK_TITLE, BOOK_AUTHOR, SHIPPING_LEVEL_MAP, FULFILLMENT_FEE_USD } from './constants.js';

const IS_SANDBOX = process.env.NEXT_PUBLIC_PAYPAL_ENV === 'sandbox';
const LULU_API = process.env.LULU_API_URL || (IS_SANDBOX ? 'https://api.sandbox.lulu.com' : 'https://api.lulu.com');
const LULU_AUTH = `${LULU_API}/auth/realms/glasstree/protocol/openid-connect/token`;
console.log('[lulu] API URL:', LULU_API);

let cachedToken = null;
let cachedExpiry = 0;

export async function getAccessToken() {
  if (cachedToken && Date.now() < cachedExpiry - 60000) return cachedToken;

  const clientKey = (IS_SANDBOX && process.env.LULU_SANDBOX_CLIENT_KEY || process.env.LULU_CLIENT_KEY || '').trim();
  const clientSecret = (IS_SANDBOX && process.env.LULU_SANDBOX_CLIENT_SECRET || process.env.LULU_CLIENT_SECRET || '').trim();

  if (!clientKey || !clientSecret) {
    const missing = [];
    if (IS_SANDBOX) {
      if (!process.env.LULU_SANDBOX_CLIENT_KEY && !process.env.LULU_CLIENT_KEY) missing.push('LULU_SANDBOX_CLIENT_KEY / LULU_CLIENT_KEY');
      if (!process.env.LULU_SANDBOX_CLIENT_SECRET && !process.env.LULU_CLIENT_SECRET) missing.push('LULU_SANDBOX_CLIENT_SECRET / LULU_CLIENT_SECRET');
    } else {
      if (!process.env.LULU_CLIENT_KEY) missing.push('LULU_CLIENT_KEY');
      if (!process.env.LULU_CLIENT_SECRET) missing.push('LULU_CLIENT_SECRET');
    }
    throw new Error(`Lulu credentials not configured: ${missing.join(', ')}`);
  }

  console.log('[lulu] Auth URL:', LULU_AUTH);
  console.log('[lulu] IS_SANDBOX:', IS_SANDBOX);
  console.log('[lulu] LULU_SANDBOX_CLIENT_KEY set:', !!process.env.LULU_SANDBOX_CLIENT_KEY);
  console.log('[lulu] LULU_SANDBOX_CLIENT_SECRET set:', !!process.env.LULU_SANDBOX_CLIENT_SECRET);
  console.log('[lulu] LULU_CLIENT_KEY set:', !!process.env.LULU_CLIENT_KEY);
  console.log('[lulu] LULU_CLIENT_SECRET set:', !!process.env.LULU_CLIENT_SECRET);
  console.log('[lulu] Using Client Key prefix:', clientKey.substring(0, 6) + '...');

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientKey,
    client_secret: clientSecret,
  });
  const res = await fetch(LULU_AUTH, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('[lulu] Auth failed — status:', res.status, 'body:', errBody);
    throw new Error(`Lulu auth failed: ${res.status} — ${errBody}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  cachedExpiry = Date.now() + (data.expires_in || 300) * 1000;
  return cachedToken;
}

// Costos de envío estimados por país y nivel de servicio (USD)
// Basado en tarifas públicas de Lulu. Se ajustan con env var LULU_SHIPPING_RATES_JSON.
const DEFAULT_SHIPPING = {
  US: { MAIL: 4.99, PRIORITY_MAIL: 8.99, EXPRESS: 19.99 },
  CA: { MAIL: 7.99, PRIORITY_MAIL: 14.99 },
  MX: { MAIL: 11.99 },
  ES: { MAIL: 9.99, EXPRESS: 18.99 },
  AR: { MAIL: 14.99 },
  CL: { MAIL: 13.99 },
  CO: { MAIL: 13.99 },
  PE: { MAIL: 13.99 },
  GB: { MAIL: 6.99, EXPRESS: 16.99 },
  DE: { MAIL: 5.99, EXPRESS: 15.99 },
  FR: { MAIL: 6.99, EXPRESS: 15.99 },
  IT: { MAIL: 7.99 },
  AU: { MAIL: 9.99, EXPRESS: 19.99 },
  JP: { MAIL: 9.99, EXPRESS: 17.99 },
  BR: { MAIL: 14.99 },
  UY: { MAIL: 13.99 },
};

function getShippingRates() {
  if (process.env.LULU_SHIPPING_RATES_JSON) {
    try { return JSON.parse(process.env.LULU_SHIPPING_RATES_JSON); }
    catch { /* fall through */ }
  }
  return DEFAULT_SHIPPING;
}

export async function calculateCosts({ country, shipping_option, quantity }) {
  const shippingLevel = SHIPPING_LEVEL_MAP[shipping_option] || SHIPPING_LEVEL_MAP._default;
  const rates = getShippingRates();
  const countryRates = rates[country];

  if (!countryRates) throw new Error(`No hay tarifas de envío para ${country}`);

  const shippingUsd = countryRates[shippingLevel];
  if (shippingUsd == null) throw new Error(`Nivel de envío ${shippingLevel} no disponible para ${country}`);

  // Costo unitario de impresión: de env var o calculado de BOOK_PAGE_COUNT
  const unitPrice = process.env.BOOK_UNIT_COST_USD
    ? parseFloat(process.env.BOOK_UNIT_COST_USD)
    : Math.round((6.00 + Math.max(0, process.env.BOOK_PAGE_COUNT ? parseInt(process.env.BOOK_PAGE_COUNT, 10) * 0.02 : 0)) * 100) / 100;

  const printingTotal = Math.round(unitPrice * quantity * 100) / 100;
  const total = Math.round((printingTotal + FULFILLMENT_FEE_USD + shippingUsd) * 100) / 100;

  return {
    breakdown: {
      unit_price_usd: Math.round(unitPrice * 100) / 100,
      quantity,
      printing_total_usd: printingTotal,
      fulfillment_fee_usd: FULFILLMENT_FEE_USD,
      shipping_usd: shippingUsd,
      total_usd: total,
    }
  };
}

export async function createPrintJob({ quantity, buyer_name, buyer_email, shipping_address, shipping_option }) {
  const token = await getAccessToken();
  const shippingLevel = SHIPPING_LEVEL_MAP[shipping_option] || SHIPPING_LEVEL_MAP._default;

  const podPackageId = process.env.LULU_POD_PACKAGE_ID;
  if (!podPackageId) throw new Error('LULU_POD_PACKAGE_ID no configurado');

  const interiorUrl = process.env.BOOK_INTERIOR_URL || '';
  const coverUrl = process.env.BOOK_COVER_URL || '';

  const lineItem = {
    external_id: `irreductible-item-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
    pod_package_id: podPackageId,
    quantity,
    title: BOOK_TITLE,
    sku: process.env.LULU_BOOK_SKU,
  };

  if (interiorUrl) {
    lineItem.interior = { source_url: interiorUrl };
    if (process.env.BOOK_INTERIOR_MD5) lineItem.interior.source_md5sum = process.env.BOOK_INTERIOR_MD5;
  }
  if (coverUrl) {
    lineItem.cover = { source_url: coverUrl };
    if (process.env.BOOK_COVER_MD5) lineItem.cover.source_md5sum = process.env.BOOK_COVER_MD5;
  }

  // Lulu limita street1 y street2 a 30 caracteres cada uno.
  // Dividimos en boundaries de palabra (espacio, coma, slash, guión, punto)
  // para no cortar palabras a la mitad.
  let street1 = (shipping_address.line1 || '').trim();
  let street2 = (shipping_address.line2 || '').trim();
  if (street1.length > 30) {
    const BOUNDARY_RE = /[\s,\/.\-]/g;
    let splitAt = 30;
    let match;
    while ((match = BOUNDARY_RE.exec(street1)) !== null) {
      if (match.index <= 30) splitAt = match.index;
      else break;
    }
    const overflow = street1.substring(splitAt).trim();
    street1 = street1.substring(0, splitAt).trim();
    street2 = overflow + (street2 ? ', ' + street2 : '');
  }
  street1 = street1.substring(0, 30);
  street2 = street2.substring(0, 30);

  const addr = {
    name: buyer_name,
    street1,
    ...(street2 ? { street2 } : {}),
    city: shipping_address.city,
    ...(shipping_address.state ? { state_code: shipping_address.state } : {}),
    country_code: shipping_address.country,
    postcode: shipping_address.postal_code,
    phone_number: shipping_address.phone,
    recipient_tax_id: 'N/A',  // Lulu exige valor no-vacío; placeholder internacional
  };

  const printJob = {
    external_id: `irreductible-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
    title: BOOK_TITLE,
    contact_email: buyer_email,
    print_job_status: 'PRODUCTION_READY',
    line_items: [lineItem],
    shipping_address: addr,
    shipping_level: shippingLevel,
  };

  const res = await fetch(`${LULU_API}/print-jobs/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(printJob),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Lulu print job failed (${res.status}): ${errText}`);
  }

  const job = await res.json();
  return { lulu_print_job_id: String(job.id), status: job.status?.name || job.status || 'CREATED' };
}
