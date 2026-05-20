// api/lulu/calculate.js
// POST /api/lulu/calculate — calcula costos de impresión + envío
// Usa constantes del libro + lookup de tarifas de envío Lulu.
// El print job real se crea en SLICE-05 después del pago.

import { calculateCosts } from '../../lib/lulu.js';

const VALID_COUNTRIES = ['US','CA','MX','ES','AR','CL','CO','PE','GB','DE','FR','IT','AU','JP','BR','UY'];

export default async function handler(req, res) {
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
