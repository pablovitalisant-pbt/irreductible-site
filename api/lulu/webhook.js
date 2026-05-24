// api/lulu/webhook.js
// POST /api/lulu/webhook — recibe eventos de Lulu Print API
// Evento principal: shipment.shipped → tracking number + email al comprador

import { getSql } from '../../lib/db.js';
import { sendBuyerTrackingUpdate } from '../../lib/email.js';
import crypto from 'crypto';

function parseRawBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, signature, secret) {
  if (!secret) {
    console.warn('[lulu/webhook] LULU_WEBHOOK_SECRET no configurado — verificación saltada');
    return true;
  }
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let rawBody;
  try {
    rawBody = await parseRawBody(req);
  } catch {
    return res.status(400).json({ error: 'Error al leer body' });
  }

  const signature = (req.headers['x-lulu-signature'] || '').trim();
  const secret = process.env.LULU_WEBHOOK_SECRET || '';

  if (!verifySignature(rawBody, signature, secret)) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Body JSON inválido' });
  }

  const eventType = body.event || body.type || '';
  console.log('[lulu/webhook] Evento recibido:', eventType);

  if (eventType !== 'shipment.shipped') {
    return res.status(200).json({ ok: true, action: 'ignored' });
  }

  const printJobId = String(body.data?.print_job_id || '');
  if (!printJobId) {
    return res.status(400).json({ error: 'Falta print_job_id en el evento' });
  }

  const shipment = body.data?.shipments?.[0] || {};
  const trackingNumber = shipment.tracking_number || '';
  const trackingUrl = shipment.tracking_url || '';
  const carrier = shipment.carrier || '';

  if (!trackingNumber) {
    console.log('[lulu/webhook] Evento shipment.shipped sin tracking_number — ignorado');
    return res.status(200).json({ ok: true, action: 'no_tracking' });
  }

  try {
    const sql = getSql();

    const updated = await sql`
      UPDATE orders
      SET status = 'shipped',
          tracking_number = ${trackingNumber},
          tracking_url = ${trackingUrl},
          carrier = ${carrier},
          updated_at = NOW()
      WHERE lulu_print_job_id = ${printJobId}
    `;

    if (updated.count === 0) {
      console.log('[lulu/webhook] No se encontró orden para print_job_id:', printJobId);
      return res.status(200).json({ ok: true, action: 'no_match' });
    }

    const rows = await sql`
      SELECT buyer_email, buyer_name, tracking_number, tracking_url, carrier
      FROM orders WHERE lulu_print_job_id = ${printJobId}
    `;

    if (rows[0]) {
      sendBuyerTrackingUpdate({
        buyer_email: rows[0].buyer_email,
        buyer_name: rows[0].buyer_name,
        tracking_number: rows[0].tracking_number,
        tracking_url: rows[0].tracking_url,
        carrier: rows[0].carrier,
      }).catch(() => {});
    }

    console.log('[lulu/webhook] Tracking guardado para print_job_id:', printJobId);
    return res.status(200).json({ ok: true, action: 'tracked' });
  } catch (e) {
    console.error('[lulu/webhook] Error:', e.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
