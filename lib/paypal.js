// lib/paypal.js
// Cliente PayPal Orders API v2 — server-side only
// Auth OAuth2 client_credentials + create order

import { BOOK_TITLE } from './constants.js';

const PAYPAL_API = process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com';
const PAYPAL_AUTH = `${PAYPAL_API}/v1/oauth2/token`;
const IS_SANDBOX = PAYPAL_API.includes('sandbox');

function getClientId() {
  return (IS_SANDBOX && process.env.PAYPAL_SANDBOX_CLIENT_ID) || process.env.PAYPAL_CLIENT_ID;
}
function getClientSecret() {
  return (IS_SANDBOX && process.env.PAYPAL_SANDBOX_CLIENT_SECRET) || process.env.PAYPAL_CLIENT_SECRET;
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

  console.log('[paypal] Auth URL:', PAYPAL_AUTH);
  console.log('[paypal] Sandbox:', IS_SANDBOX, '| Client ID prefix:', clientId.substring(0, 6) + '...');

  const res = await fetch(PAYPAL_AUTH, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
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

export async function createOrder({ total_usd, breakdown, buyer_email, buyer_name, return_url, cancel_url }) {
  const token = await getAccessToken();
  const qty = breakdown?.quantity || 1;

  const order = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'USD',
        value: total_usd.toFixed(2),
        breakdown: {
          item_total: { currency_code:'USD', value: (breakdown.printing_total_usd || total_usd).toFixed(2) },
          shipping: { currency_code:'USD', value: (breakdown.shipping_usd || 0).toFixed(2) },
          handling: { currency_code:'USD', value: (breakdown.fulfillment_fee_usd || 0).toFixed(2) },
        }
      },
      description: `${BOOK_TITLE} (×${qty})`,
    }],
    payer: {
      name: { given_name: buyer_name },
      email_address: buyer_email,
    },
  };

  if (return_url || cancel_url) {
    order.application_context = {
      ...(return_url ? { return_url } : {}),
      ...(cancel_url ? { cancel_url } : {}),
      user_action: 'PAY_NOW',
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
