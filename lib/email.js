// lib/email.js
// Emails transaccionales vía Resend — no bloqueantes
// Si Resend falla, la operación principal sigue funcionando.

import { Resend } from 'resend';
import { BOOK_TITLE } from './constants.js';

const FROM = process.env.RESEND_FROM || 'IRREDUCTIBLE <pablo@irreductible.site>';
const ADMIN = process.env.ADMIN_EMAIL || 'pablo@irreductible.site';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendBuyerConfirmation({ buyer_email, buyer_name, paypal_order_id, total_usd, quantity }) {
  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#131313;color:#e5e2e1;padding:32px;max-width:560px;margin:0 auto">
<h1 style="font-family:'Bebas Neue',sans-serif;color:#b8922a;font-size:28px;letter-spacing:0.05em">COMPRA CONFIRMADA</h1>
<p>Hola ${buyer_name},</p>
<p>Tu orden de <strong>${BOOK_TITLE}</strong> fue confirmada.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
<tr><td style="padding:8px;border-bottom:1px solid #4e4636;color:#d1c5b0">Cantidad</td><td style="padding:8px;border-bottom:1px solid #4e4636">${quantity}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #4e4636;color:#d1c5b0">Total pagado</td><td style="padding:8px;border-bottom:1px solid #4e4636;color:#b8922a;font-weight:bold">USD $${total_usd}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #4e4636;color:#d1c5b0">Orden PayPal</td><td style="padding:8px;border-bottom:1px solid #4e4636;font-family:monospace;font-size:12px">${paypal_order_id}</td></tr>
</table>
<p style="color:#d1c5b0">Lulu imprimirá y despachará tu libro en los próximos días. Recibirás el número de seguimiento apenas el transportista lo registre.</p>
<p style="color:#98ccf6;margin-top:24px">— IRREDUCTIBLE</p>
</body></html>`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to: buyer_email,
      subject: `Tu orden IRREDUCTIBLE — Confirmación de compra`,
      html,
    });
    console.log('[email] Buyer confirmation sent to', buyer_email);
  } catch (e) {
    console.error('[email] Buyer confirmation failed:', e.message);
  }
}

export async function sendAdminNotification({ buyer_name, buyer_email, total_usd, quantity, paypal_order_id, lulu_print_job_id, shipping_address, shipping_option }) {
  const addr = shipping_address || {};
  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#131313;color:#e5e2e1;padding:32px;max-width:560px;margin:0 auto">
<h1 style="font-family:'Bebas Neue',sans-serif;color:#b8922a;font-size:28px;letter-spacing:0.05em">NUEVA VENTA</h1>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
<tr><td style="padding:8px;border-bottom:1px solid #4e4636;color:#d1c5b0">Comprador</td><td style="padding:8px;border-bottom:1px solid #4e4636">${buyer_name} &lt;${buyer_email}&gt;</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #4e4636;color:#d1c5b0">Cantidad</td><td style="padding:8px;border-bottom:1px solid #4e4636">${quantity}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #4e4636;color:#d1c5b0">Total</td><td style="padding:8px;border-bottom:1px solid #4e4636;color:#b8922a;font-weight:bold">USD $${total_usd}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #4e4636;color:#d1c5b0">Envío</td><td style="padding:8px;border-bottom:1px solid #4e4636">${addr.city || ''}, ${addr.country || ''} (${shipping_option || 'N/A'})</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #4e4636;color:#d1c5b0">PayPal Order</td><td style="padding:8px;border-bottom:1px solid #4e4636;font-family:monospace;font-size:10px">${paypal_order_id}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #4e4636;color:#d1c5b0">Lulu Print Job</td><td style="padding:8px;border-bottom:1px solid #4e4636;font-family:monospace;font-size:10px">${lulu_print_job_id || '—'}</td></tr>
</table>
</body></html>`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to: ADMIN,
      subject: `Nueva venta IRREDUCTIBLE — $${total_usd}`,
      html,
    });
    console.log('[email] Admin notification sent to', ADMIN);
  } catch (e) {
    console.error('[email] Admin notification failed:', e.message);
  }
}

export async function sendBuyerTrackingUpdate({ buyer_email, buyer_name, tracking_number, tracking_url, carrier }) {
  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#131313;color:#e5e2e1;padding:32px;max-width:560px;margin:0 auto">
<h1 style="font-family:'Bebas Neue',sans-serif;color:#b8922a;font-size:28px;letter-spacing:0.05em">TU LIBRO ESTÁ EN CAMINO</h1>
<p>Hola ${buyer_name},</p>
<p><strong>${BOOK_TITLE}</strong> fue despachado.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
<tr><td style="padding:8px;border-bottom:1px solid #4e4636;color:#d1c5b0">Transportista</td><td style="padding:8px;border-bottom:1px solid #4e4636">${carrier || 'No especificado'}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #4e4636;color:#d1c5b0">Seguimiento</td><td style="padding:8px;border-bottom:1px solid #4e4636;font-family:monospace;font-size:14px">${tracking_number}</td></tr>
${tracking_url ? `<tr><td style="padding:8px;border-bottom:1px solid #4e4636;color:#d1c5b0">Link</td><td style="padding:8px;border-bottom:1px solid #4e4636"><a href="${tracking_url}" style="color:#98ccf6">Ver seguimiento</a></td></tr>` : ''}
</table>
<p style="color:#d1c5b0">El transportista puede tardar hasta 24 horas en activar el número de seguimiento.</p>
<p style="color:#98ccf6;margin-top:24px">— IRREDUCTIBLE</p>
</body></html>`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to: buyer_email,
      subject: `Tu libro IRREDUCTIBLE está en camino — ${tracking_number}`,
      html,
    });
    console.log('[email] Tracking update sent to', buyer_email);
  } catch (e) {
    console.error('[email] Tracking update failed:', e.message);
  }
}
