// api/paypal/create-order.js
// POST /api/paypal/create-order — crea orden PayPal con el monto calculado
// Retorna order_id + approval_url para que el cliente redirija al comprador.

import { createOrder } from '../../lib/paypal.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Body JSON inválido' }); }

  const { total_usd, breakdown, buyer_email, buyer_name } = body || {};

  if (!total_usd || typeof total_usd !== 'number') return res.status(400).json({ error: 'total_usd es requerido (number)' });
  if (total_usd <= 0) return res.status(400).json({ error: 'total_usd debe ser mayor a 0' });
  if (total_usd > 500) return res.status(400).json({ error: 'total_usd máximo es USD 500' });

  if (!buyer_email || !EMAIL_RE.test(buyer_email)) return res.status(400).json({ error: 'buyer_email es requerido y debe ser válido' });
  if (!buyer_name || buyer_name.trim().length < 2) return res.status(400).json({ error: 'buyer_name es requerido' });

  if (!breakdown || typeof breakdown !== 'object') return res.status(400).json({ error: 'breakdown es requerido' });

  try {
    const result = await createOrder({ total_usd, breakdown, buyer_email, buyer_name: buyer_name.trim() });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('[paypal/create-order]', e.message);
    if (e.message.includes('auth failed')) return res.status(502).json({ error: 'Error de autenticación con PayPal' });
    return res.status(502).json({ error: `Error al crear orden PayPal: ${e.message}` });
  }
}
