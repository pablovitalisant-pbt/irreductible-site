// api/paypal/create-order.js
// POST /api/paypal/create-order — crea orden PayPal + guarda orden en DB (status=pending)

import { createOrder } from '../../lib/paypal.js';
import { getSql } from '../../lib/db.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
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

    // Guardar orden en DB (status=pending)
    try {
      const sql = getSql();
      await sql`
        INSERT INTO orders (paypal_order_id, status, quantity, unit_price_usd, shipping_usd, fulfillment_fee_usd, total_usd, buyer_email, buyer_name, shipping_address, shipping_option)
        VALUES (${result.paypal_order_id}, 'pending', ${quantity || breakdown.quantity || 1}, ${breakdown.unit_price_usd || 0}, ${breakdown.shipping_usd || 0}, ${breakdown.fulfillment_fee_usd || 0.75}, ${total_usd}, ${buyer_email}, ${buyer_name.trim()}, ${JSON.stringify(shipping_address || {})}, ${shipping_option || 'unknown'})
      `;
    } catch (dbErr) {
      console.error('[paypal/create-order] DB insert failed:', dbErr.message);
      // No fallar la request — la orden PayPal ya fue creada
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('[paypal/create-order]', e.message);
    if (e.message.includes('auth failed')) return res.status(502).json({ error: 'Error de autenticación con PayPal' });
    return res.status(502).json({ error: `Error al crear orden PayPal: ${e.message}` });
  }
}
