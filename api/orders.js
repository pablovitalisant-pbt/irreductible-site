// api/orders.js
// GET /api/orders?paypal_order_id=<id>
// Consulta pública de orden — sin auth. Solo expone datos de quien ya tiene el paypal_order_id.

import { getSql } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { searchParams } = new URL(req.url, 'http://localhost');
  const paypal_order_id = searchParams.get('paypal_order_id');

  if (!paypal_order_id || typeof paypal_order_id !== 'string' || !paypal_order_id.trim()) {
    return res.status(400).json({ error: 'paypal_order_id es requerido' });
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT status, quantity, total_usd, buyer_name, buyer_email,
             tracking_number, tracking_url, carrier, created_at
      FROM orders
      WHERE paypal_order_id = ${paypal_order_id.trim()}
      LIMIT 1
    `;

    if (!rows[0]) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    return res.status(200).json({ ok: true, order: rows[0] });
  } catch (e) {
    console.error('[api/orders]', e.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
