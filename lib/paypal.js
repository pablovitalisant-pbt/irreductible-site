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
  const res = await fetch(PAYPAL_AUTH, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${getClientId()}:${getClientSecret()}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token;
  cachedExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

export async function createOrder({ total_usd, breakdown, buyer_email, buyer_name }) {
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
