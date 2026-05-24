// api/paypal.js
// Handler consolidado PayPal — rutea por query param ?action=
// Acciones: create-order, capture-order

import { createOrder, captureOrder } from '../lib/paypal.js';
import { getSql } from '../lib/db.js';
import { sendBuyerConfirmation } from '../lib/email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAction(req) {
  try {
    const { searchParams } = new URL(req.url, 'http://localhost');
    return searchParams.get('action') || '';
  } catch { return ''; }
}

// ── create-order ──────────────────────────────────────────────────

async function handleCreateOrder(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Body JSON inválido' }); }
  const { total_usd, breakdown, buyer_email, buyer_name, shipping_address, shipping_option, quantity } = body || {};
  if (!total_usd || typeof total_usd !== 'number') return res.status(400).json({ error: 'total_usd es requerido (number)' });
  if (total_usd <= 0) return res.status(400).json({ error: 'total_usd debe ser mayor a 0' });
  if (total_usd > 500) return res.status(400).json({ error: 'total_usd máximo es USD 500' });
  if (!buyer_email || !EMAIL_RE.test(buyer_email)) return res.status(400).json({ error: 'buyer_email es requerido y debe ser válido' });
  if (!buyer_name || buyer_name.trim().length < 2) return res.status(400).json({ error: 'buyer_name es requerido' });
  if (!breakdown || typeof breakdown !== 'object') return res.status(400).json({ error: 'breakdown es requerido' });
  try {
    const result = await createOrder({ total_usd, breakdown, buyer_email, buyer_name: buyer_name.trim() });
    try {
      const sql = getSql();
      await sql`
        INSERT INTO orders (paypal_order_id, status, quantity, unit_price_usd, shipping_usd, fulfillment_fee_usd, total_usd, buyer_email, buyer_name, shipping_address, shipping_option)
        VALUES (${result.paypal_order_id}, 'pending', ${quantity || breakdown.quantity || 1}, ${breakdown.unit_price_usd || 0}, ${breakdown.shipping_usd || 0}, ${breakdown.fulfillment_fee_usd || 0.75}, ${total_usd}, ${buyer_email}, ${buyer_name.trim()}, ${JSON.stringify(shipping_address || {})}, ${shipping_option || 'unknown'})
      `;
    } catch (dbErr) { console.error('[paypal/create-order] DB insert failed:', dbErr.message); }
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('[paypal/create-order]', e.message);
    if (e.message.includes('auth failed')) return res.status(502).json({ error: 'Error de autenticación con PayPal' });
    return res.status(502).json({ error: `Error al crear orden PayPal: ${e.message}` });
  }
}

// ── capture-order ─────────────────────────────────────────────────

async function handleCaptureOrder(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Body JSON inválido' }); }
  const { paypal_order_id } = body || {};
  if (!paypal_order_id || typeof paypal_order_id !== 'string' || !paypal_order_id.trim()) {
    return res.status(400).json({ error: 'paypal_order_id es requerido' });
  }
  try {
    const result = await captureOrder(paypal_order_id.trim());
    let order = null;
    try {
      const sql = getSql();
      await sql`UPDATE orders SET status = 'paid', updated_at = NOW() WHERE paypal_order_id = ${paypal_order_id.trim()}`;
      const rows = await sql`SELECT buyer_email, buyer_name, total_usd, quantity FROM orders WHERE paypal_order_id = ${paypal_order_id.trim()}`;
      order = rows[0];
    } catch (dbErr) { console.error('[paypal/capture-order] DB update failed:', dbErr.message); }
    if (order) {
      sendBuyerConfirmation({
        buyer_email: order.buyer_email, buyer_name: order.buyer_name,
        paypal_order_id: paypal_order_id.trim(), total_usd: order.total_usd, quantity: order.quantity,
      }).catch(() => {});
    }
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('[paypal/capture-order]', e.message);
    if (e.message === 'ORDER_ALREADY_CAPTURED') return res.status(409).json({ error: 'La orden ya fue capturada' });
    if (e.message === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Orden no encontrada' });
    if (e.message.includes('auth failed')) return res.status(502).json({ error: 'Error de autenticación con PayPal' });
    return res.status(502).json({ error: `Error al capturar orden: ${e.message}` });
  }
}

// ── router ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const action = getAction(req);
  switch (action) {
    case 'create-order': return handleCreateOrder(req, res);
    case 'capture-order': return handleCaptureOrder(req, res);
    default: return res.status(404).json({ error: `Acción desconocida: ${action}` });
  }
}
