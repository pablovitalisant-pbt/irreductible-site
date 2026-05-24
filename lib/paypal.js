// lib/paypal.js
// Cliente PayPal Orders API v2 — server-side only
// Auth OAuth2 client_credentials + create order

import { BOOK_TITLE } from './constants.js';

const IS_SANDBOX = process.env.NEXT_PUBLIC_PAYPAL_ENV === 'sandbox';
const PAYPAL_API = process.env.PAYPAL_API_URL || (IS_SANDBOX ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com');
const PAYPAL_AUTH = `${PAYPAL_API}/v1/oauth2/token`;

function getClientId() {
  const val = (IS_SANDBOX && process.env.PAYPAL_SANDBOX_CLIENT_ID) || process.env.PAYPAL_CLIENT_ID;
  return val ? val.trim() : val;
}
function getClientSecret() {
  const val = (IS_SANDBOX && process.env.PAYPAL_SANDBOX_CLIENT_SECRET) || process.env.PAYPAL_CLIENT_SECRET;
  return val ? val.trim() : val;
}

let cachedToken = null;
let cachedExpiry = 0;

export async function getAccessToken() {
  if (cachedToken && Date.now() < cachedExpiry - 60000) return cachedToken;

  const clientId = getClientId();
  const clientSecret = getClientSecret();

  if (!clientId || !clientSecret) {
    const missing = [];
    if (IS_SANDBOX) {
      if (!process.env.PAYPAL_SANDBOX_CLIENT_ID && !process.env.PAYPAL_CLIENT_ID) missing.push('PAYPAL_SANDBOX_CLIENT_ID / PAYPAL_CLIENT_ID');
      if (!process.env.PAYPAL_SANDBOX_CLIENT_SECRET && !process.env.PAYPAL_CLIENT_SECRET) missing.push('PAYPAL_SANDBOX_CLIENT_SECRET / PAYPAL_CLIENT_SECRET');
    } else {
      if (!process.env.PAYPAL_CLIENT_ID) missing.push('PAYPAL_CLIENT_ID');
      if (!process.env.PAYPAL_CLIENT_SECRET) missing.push('PAYPAL_CLIENT_SECRET');
    }
    throw new Error(`PayPal credentials not configured: ${missing.join(', ')}`);
  }

  console.log('[paypal] IS_SANDBOX:', IS_SANDBOX);
  console.log('[paypal] PAYPAL_SANDBOX_CLIENT_ID set:', !!process.env.PAYPAL_SANDBOX_CLIENT_ID);
  console.log('[paypal] PAYPAL_SANDBOX_CLIENT_SECRET set:', !!process.env.PAYPAL_SANDBOX_CLIENT_SECRET);
  console.log('[paypal] PAYPAL_CLIENT_ID set:', !!process.env.PAYPAL_CLIENT_ID);
  console.log('[paypal] PAYPAL_CLIENT_SECRET set:', !!process.env.PAYPAL_CLIENT_SECRET);
  console.log('[paypal] Auth URL:', PAYPAL_AUTH);
  console.log('[paypal] Using Client ID prefix:', clientId.substring(0, 6) + '...');

  const res = await fetch(PAYPAL_AUTH, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('[paypal] Auth failed — status:', res.status, 'body:', errBody);
    throw new Error(`PayPal auth failed: ${res.status} — ${errBody}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  cachedExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

export async function createOrder({ total_usd, breakdown, buyer_email, buyer_name, return_url, cancel_url, shipping_address }) {
  const token = await getAccessToken();
  const qty = breakdown?.quantity || 1;

  // Separar nombre en given_name + surname
  const nameParts = (buyer_name || '').trim().split(/\s+/);
  const givenName = nameParts[0] || buyer_name;
  const surname = nameParts.slice(1).join(' ') || buyer_name;

  const purchaseUnit = {
    amount: {
      currency_code: 'USD',
      value: total_usd.toFixed(2),
      breakdown: {
        item_total: { currency_code:'USD', value: (breakdown.printing_total_usd || total_usd).toFixed(2) },
        shipping: { currency_code:'USD', value: (breakdown.shipping_usd || 0).toFixed(2) },
      }
    },
    description: `${BOOK_TITLE} (×${qty})`,
  };

  const addr = shipping_address || {};
  const phoneNumber = (addr.phone || '').replace(/[^0-9]/g, '');

  if (shipping_address) {
    purchaseUnit.shipping = {
      name: { full_name: buyer_name },
      phone_number: phoneNumber ? { national_number: phoneNumber } : undefined,
      address: {
        address_line_1: (addr.line1 || '').substring(0, 100),
        address_line_2: (addr.line2 || '').substring(0, 100),
        admin_area_1: (addr.state || '').substring(0, 60),
        admin_area_2: (addr.city || '').substring(0, 60),
        postal_code: (addr.postal_code || '').substring(0, 10),
        country_code: addr.country || '',
      },
    };
  }

  const payerAddress = shipping_address ? {
    address_line_1: (addr.line1 || '').substring(0, 100),
    address_line_2: (addr.line2 || '').substring(0, 100),
    admin_area_1: (addr.state || '').substring(0, 60),
    admin_area_2: (addr.city || '').substring(0, 60),
    postal_code: (addr.postal_code || '').substring(0, 10),
    country_code: addr.country || '',
  } : undefined;

  const order = {
    intent: 'CAPTURE',
    purchase_units: [purchaseUnit],
    payer: {
      name: { given_name: givenName, surname },
      email_address: buyer_email,
      ...(payerAddress ? { address: payerAddress } : {}),
      ...(phoneNumber ? { phone: { phone_number: { national_number: phoneNumber } } } : {}),
    },
    payment_source: {
      card: {
        attributes: {
          verification: { method: 'SCA_WHEN_REQUIRED' },
        },
      },
    },
  };

  if (return_url || cancel_url) {
    order.application_context = {
      ...(return_url ? { return_url } : {}),
      ...(cancel_url ? { cancel_url } : {}),
      user_action: 'PAY_NOW',
      ...(shipping_address ? { shipping_preference: 'SET_PROVIDED_ADDRESS' } : {}),
    };
  } else if (shipping_address) {
    order.application_context = {
      shipping_preference: 'SET_PROVIDED_ADDRESS',
    };
  }

  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `irreductible-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
    },
    body: JSON.stringify(order),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`PayPal create order failed (${res.status}): ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const approvalUrl = data.links?.find(l => l.rel === 'approve')?.href || '';

  return { paypal_order_id: data.id, approval_url: approvalUrl };
}

export async function captureOrder(paypal_order_id) {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${paypal_order_id}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const errName = data.name || 'UNKNOWN';
    if (errName === 'ORDER_ALREADY_CAPTURED') throw new Error('ORDER_ALREADY_CAPTURED');
    if (res.status === 404) throw new Error('ORDER_NOT_FOUND');
    throw new Error(`PayPal capture failed (${res.status}): ${JSON.stringify(data)}`);
  }

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0] || {};
  return {
    capture_id: capture.id || data.id,
    status: data.status || capture.status || 'COMPLETED',
    amount_usd: capture.amount?.value || '0.00',
  };
}
