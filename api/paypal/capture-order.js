// api/paypal/capture-order.js
// POST /api/paypal/capture-order — captura el pago PayPal después de aprobación del comprador
// Se llama desde el frontend después de que PayPal redirige con éxito.

import { captureOrder } from '../../lib/paypal.js';

export default async function handler(req, res) {
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
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('[paypal/capture-order]', e.message);
    if (e.message === 'ORDER_ALREADY_CAPTURED') return res.status(409).json({ error: 'La orden ya fue capturada' });
    if (e.message === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Orden no encontrada' });
    if (e.message.includes('auth failed')) return res.status(502).json({ error: 'Error de autenticación con PayPal' });
    return res.status(502).json({ error: `Error al capturar orden: ${e.message}` });
  }
}
