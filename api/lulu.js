// api/lulu.js
// Handler consolidado Lulu — rutea por query param ?action=
// Acciones: calculate, create-print-job, webhook

import { calculateCosts, createPrintJob } from '../lib/lulu.js';
import { getSql } from '../lib/db.js';
import { sendAdminNotification, sendBuyerTrackingUpdate } from '../lib/email.js';
import crypto from 'crypto';

const VALID_COUNTRIES = ['US','CA','MX','ES','AR','CL','CO','PE','GB','DE','FR','IT','AU','JP','BR','UY'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAction(req) {
  try {
    const { searchParams } = new URL(req.url, 'http://localhost');
    return searchParams.get('action') || '';
  } catch { return ''; }
}

// ── calculate ─────────────────────────────────────────────────────

async function handleCalculate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Body JSON inválido' }); }
  const { country, shipping_option, quantity } = body || {};
  if (!country || !quantity) return res.status(400).json({ error: 'country, quantity son requeridos' });
  const qty = parseInt(quantity, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) return res.status(400).json({ error: 'quantity debe ser entre 1 y 10' });
  if (!shipping_option) return res.status(400).json({ error: 'shipping_option es requerido' });
  if (!VALID_COUNTRIES.includes(country)) return res.status(422).json({ error: 'País no soportado' });
  try {
    const result = await calculateCosts({ country, shipping_option, quantity: qty });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('[lulu/calculate]', e.message);
    return res.status(422).json({ error: e.message });
  }
}

// ── create-print-job ──────────────────────────────────────────────

async function handleCreatePrintJob(req, res) {
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
    return res.status(400).json({ error: 'shipping_address incompleto' });
  }
  if (!shipping_option) return res.status(400).json({ error: 'shipping_option requerido' });
  try {
    const result = await createPrintJob({ quantity: qty, buyer_name: buyer_name.trim(), buyer_email, shipping_address, shipping_option });
    let order = null;
    try {
      const sql = getSql();
      const orderId = paypal_order_id || 'unknown';
      await sql`UPDATE orders SET status = 'print_submitted', lulu_print_job_id = ${result.lulu_print_job_id}, updated_at = NOW() WHERE paypal_order_id = ${orderId}`;
      const rows = await sql`SELECT buyer_name, buyer_email, total_usd, quantity, shipping_address, shipping_option FROM orders WHERE paypal_order_id = ${orderId}`;
      order = rows[0];
    } catch (dbErr) { console.error('[lulu/create-print-job] DB update failed:', dbErr.message); }
    if (order) {
      sendAdminNotification({
        buyer_name: order.buyer_name, buyer_email: order.buyer_email,
        total_usd: order.total_usd, quantity: order.quantity,
        paypal_order_id: paypal_order_id || 'unknown',
        lulu_print_job_id: result.lulu_print_job_id,
        shipping_address: order.shipping_address, shipping_option: order.shipping_option,
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

// ── webhook ───────────────────────────────────────────────────────

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
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); }
  catch { return false; }
}

async function handleWebhook(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let rawBody;
  try { rawBody = await parseRawBody(req); }
  catch { return res.status(400).json({ error: 'Error al leer body' }); }
  const signature = (req.headers['x-lulu-signature'] || '').trim();
  if (!verifySignature(rawBody, signature, process.env.LULU_WEBHOOK_SECRET || '')) {
    return res.status(401).json({ error: 'Firma inválida' });
  }
  let body;
  try { body = JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: 'Body JSON inválido' }); }
  const eventType = body.event || body.type || '';
  console.log('[lulu/webhook] Evento recibido:', eventType);
  if (eventType !== 'shipment.shipped') return res.status(200).json({ ok: true, action: 'ignored' });
  const printJobId = String(body.data?.print_job_id || '');
  if (!printJobId) return res.status(400).json({ error: 'Falta print_job_id en el evento' });
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
      UPDATE orders SET status = 'shipped', tracking_number = ${trackingNumber},
        tracking_url = ${trackingUrl}, carrier = ${carrier}, updated_at = NOW()
      WHERE lulu_print_job_id = ${printJobId}`;
    if (updated.count === 0) {
      console.log('[lulu/webhook] No se encontró orden para print_job_id:', printJobId);
      return res.status(200).json({ ok: true, action: 'no_match' });
    }
    const rows = await sql`SELECT buyer_email, buyer_name, tracking_number, tracking_url, carrier FROM orders WHERE lulu_print_job_id = ${printJobId}`;
    if (rows[0]) {
      sendBuyerTrackingUpdate({
        buyer_email: rows[0].buyer_email, buyer_name: rows[0].buyer_name,
        tracking_number: rows[0].tracking_number, tracking_url: rows[0].tracking_url, carrier: rows[0].carrier,
      }).catch(() => {});
    }
    console.log('[lulu/webhook] Tracking guardado para print_job_id:', printJobId);
    return res.status(200).json({ ok: true, action: 'tracked' });
  } catch (e) {
    console.error('[lulu/webhook] Error:', e.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}

// ── router ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const action = getAction(req);
  switch (action) {
    case 'calculate': return handleCalculate(req, res);
    case 'create-print-job': return handleCreatePrintJob(req, res);
    case 'webhook': return handleWebhook(req, res);
    default: return res.status(404).json({ error: `Acción desconocida: ${action}` });
  }
}
