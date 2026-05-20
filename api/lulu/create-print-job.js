// api/lulu/create-print-job.js
// POST /api/lulu/create-print-job — crea print job en Lulu + actualiza DB + notifica admin

import { createPrintJob } from '../../lib/lulu.js';
import { getSql } from '../../lib/db.js';
import { sendAdminNotification } from '../../lib/email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Body JSON inválido' }); }

  const { quantity, buyer_name, buyer_email, shipping_address, shipping_option, paypal_order_id } = body || {};

  const qty = parseInt(quantity, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) return res.status(400).json({ error: 'quantity debe ser entre 1 y 10' });
  if (!buyer_email || !EMAIL_RE.test(buyer_email)) return res.status(400).json({ error: 'buyer_email requerido' });
  if (!buyer_name || buyer_name.trim().length < 2) return res.status(400).json({ error: 'buyer_name requerido' });
  if (!shipping_address || typeof shipping_address !== 'object') return res.status(400).json({ error: 'shipping_address requerido' });
  if (!shipping_address.country || !shipping_address.city || !shipping_address.line1 || !shipping_address.postal_code || !shipping_address.phone) {
    return res.status(400).json({ error: 'shipping_address incompleto (country, city, line1, postal_code, phone)' });
  }
  if (!shipping_option) return res.status(400).json({ error: 'shipping_option requerido' });

  try {
    const result = await createPrintJob({
      quantity: qty, buyer_name: buyer_name.trim(), buyer_email,
      shipping_address, shipping_option,
    });

    // Actualizar DB: status = print_submitted + lulu_print_job_id
    let order = null;
    try {
      const sql = getSql();
      const orderId = paypal_order_id || 'unknown';
      await sql`UPDATE orders SET status = 'print_submitted', lulu_print_job_id = ${result.lulu_print_job_id}, updated_at = NOW() WHERE paypal_order_id = ${orderId}`;
      const rows = await sql`SELECT buyer_name, buyer_email, total_usd, quantity, shipping_address, shipping_option FROM orders WHERE paypal_order_id = ${orderId}`;
      order = rows[0];
    } catch (dbErr) {
      console.error('[lulu/create-print-job] DB update failed:', dbErr.message);
    }

    // Notificación a Pablo (no bloqueante)
    if (order) {
      sendAdminNotification({
        buyer_name: order.buyer_name,
        buyer_email: order.buyer_email,
        total_usd: order.total_usd,
        quantity: order.quantity,
        paypal_order_id: paypal_order_id || 'unknown',
        lulu_print_job_id: result.lulu_print_job_id,
        shipping_address: order.shipping_address,
        shipping_option: order.shipping_option,
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('[lulu/create-print-job]', e.message);
    if (e.message === 'LULU_POD_PACKAGE_ID no configurado') return res.status(503).json({ error: 'Servicio no configurado' });
    if (e.message.includes('auth failed')) return res.status(502).json({ error: 'Error de autenticación con Lulu' });
    return res.status(502).json({ error: `Error al crear print job: ${e.message}` });
  }
}
