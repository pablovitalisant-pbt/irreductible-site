// lib/lulu.js
// Cliente Lulu Print API — server-side only
// Autenticación OAuth2 + cálculo de costos con constantes (el print job real va en SLICE-05)

import { BOOK_SKU, BOOK_TITLE, BOOK_AUTHOR, BOOK_PAGE_COUNT, SHIPPING_LEVEL_MAP, BOOK_SELL_PRICE_USD } from './constants.js';

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

// ── Cost Estimate via Lulu API ───────────────────────────────────

// Placeholder address per country for cost calculation (user hasn't entered
// full address yet when costs are fetched — country drives shipping cost).
const PLACEHOLDER_ADDRESS = {
  US: { city: 'Los Angeles', street1: '123 Main St', postcode: '90001', state_code: 'CA', phone_number: '+12125551234' },
  CA: { city: 'Toronto', street1: '123 Queen St', postcode: 'M5V 2A1', state_code: 'ON', phone_number: '+14165551234' },
  MX: { city: 'Ciudad de Mexico', street1: 'Av. Reforma 123', postcode: '06600', phone_number: '+525555123456' },
  ES: { city: 'Madrid', street1: 'Calle Mayor 1', postcode: '28013', state_code: 'M', phone_number: '+34915551234' },
  AR: { city: 'Buenos Aires', street1: 'Av. Corrientes 1234', postcode: 'C1043AAZ', phone_number: '+541155123456' },
  CL: { city: 'Santiago', street1: 'Av. Providencia 123', postcode: '8320000', phone_number: '+56955123456', recipient_tax_id: '11111111-1' },
  CO: { city: 'Bogota', street1: 'Carrera 7 #123', postcode: '110111', phone_number: '+573001234567' },
  PE: { city: 'Lima', street1: 'Av. Larco 123', postcode: '15074', phone_number: '+51999123456' },
  GB: { city: 'London', street1: '123 Oxford St', postcode: 'W1D 1BS', phone_number: '+442071234567' },
  DE: { city: 'Berlin', street1: 'Friedrichstr. 123', postcode: '10117', phone_number: '+493012345678' },
  FR: { city: 'Paris', street1: '123 Rue de Rivoli', postcode: '75001', phone_number: '+33112345678' },
  IT: { city: 'Roma', street1: 'Via del Corso 123', postcode: '00186', phone_number: '+390612345678' },
  AU: { city: 'Sydney', street1: '123 George St', postcode: '2000', phone_number: '+61212345678' },
  JP: { city: 'Tokyo', street1: '1-2-3 Shinjuku', postcode: '1600022', phone_number: '+81312345678' },
  BR: { city: 'Sao Paulo', street1: 'Av. Paulista 123', postcode: '01310100', phone_number: '+5511912345678', recipient_tax_id: '00000000000' },
  UY: { city: 'Montevideo', street1: 'Av. 18 de Julio 1234', postcode: '11200', phone_number: '+59899123456' },
};

function buildPlaceholderAddress(country) {
  const preset = PLACEHOLDER_ADDRESS[country];
  return { country_code: country, ...(preset || { city: 'N/A', street1: 'N/A', postcode: '00000', phone_number: '+0000000000' }) };
}

async function getCostEstimate({ country, shipping_level, quantity }) {
  const token = await getAccessToken();
  const podPackageId = process.env.LULU_POD_PACKAGE_ID;
  if (!podPackageId) throw new Error('LULU_POD_PACKAGE_ID no configurado');

  const pageCount = BOOK_PAGE_COUNT || 1;

  const body = {
    line_items: [{
      page_count: pageCount,
      pod_package_id: podPackageId,
      quantity,
    }],
    shipping_address: buildPlaceholderAddress(country),
    shipping_level,
  };

  const res = await fetch(`${LULU_API}/print-job-cost-calculations/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Lulu cost estimate failed (${res.status}): ${errText}`);
  }

  return res.json();
}

// ── calculateCosts ───────────────────────────────────────────────

export async function calculateCosts({ country, shipping_option, quantity }) {
  const shippingLevel = SHIPPING_LEVEL_MAP[shipping_option] || SHIPPING_LEVEL_MAP._default;

  // Obtener shipping real de Lulu (o fallback)
  let shippingUsd;
  try {
    const estimate = await getCostEstimate({ country, shipping_level: shippingLevel, quantity });
    shippingUsd = parseFloat(estimate.shipping_cost.total_cost_incl_tax);
  } catch (e) {
    console.error('[lulu/calculate] API cost estimate falló, usando valores hardcodeados:', e.message);
    const rates = getShippingRates();
    const countryRates = rates[country];
    if (!countryRates) throw new Error(`No hay tarifas de envío para ${country}`);
    shippingUsd = countryRates[shippingLevel];
    if (shippingUsd == null) throw new Error(`Nivel de envío ${shippingLevel} no disponible para ${country}`);
  }

  const printingTotal = Math.round(BOOK_SELL_PRICE_USD * quantity * 100) / 100;
  const total = Math.round((printingTotal + shippingUsd) * 100) / 100;

  return {
    breakdown: {
      unit_price_usd: BOOK_SELL_PRICE_USD,
      quantity,
      printing_total_usd: printingTotal,
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
    recipient_tax_id: shipping_address.tax_id || 'N/A',
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
