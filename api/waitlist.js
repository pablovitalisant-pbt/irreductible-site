import { neon } from '@neondatabase/serverless';
import { Resend } from 'resend';
import { RateLimiter } from './_lib/rate-limiter.js';
import { validate as validateEmail } from './_lib/email-validator.js';

const rateLimiter = new RateLimiter({ maxRequests: 5, windowMs: 15 * 60 * 1000 });
const TAG = 'lista_espera_libro';

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        const trimmed = data.trim();
        if (trimmed.startsWith('{')) { resolve(JSON.parse(data)); }
        else if (trimmed) {
          const params = new URLSearchParams(trimmed);
          const obj = {};
          params.forEach((value, key) => { obj[key] = value; });
          resolve(obj);
        } else { resolve({}); }
      } catch { reject(new Error('Body inválido')); }
    });
    req.on('error', reject);
  });
}

function getClientIP(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const clientIP = getClientIP(req);
  if (!rateLimiter.check(clientIP)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' });
  }

  let body;
  try { body = await parseBody(req); } catch {
    return res.status(400).json({ error: 'Body inválido' });
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !validateEmail(email).valid) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const siteUrl = process.env.SITE_URL || 'https://irreductible.site';

    // Verificar si ya existe
    const existing = await sql`SELECT id, unsubscribe_token, tags FROM subscribers WHERE email = ${email}`;

    if (existing.length > 0) {
      // Ya existe — agregar tag si no lo tiene
      const sub = existing[0];
      await sql`
        UPDATE subscribers
        SET tags = array_append(tags, ${TAG})
        WHERE id = ${sub.id} AND NOT (${TAG} = ANY(tags))
      `;
    } else {
      // Nuevo suscriptor
      const result = await sql`
        INSERT INTO subscribers (email, source, tags)
        VALUES (${email}, 'lista_espera_libro', ARRAY[${TAG}]::text[])
        RETURNING id, unsubscribe_token
      `;
      existing.push(result[0]);
    }

    // Enviar email de confirmación (si hay template y el suscriptor tiene token)
    const sub = existing[0];
    if (sub.unsubscribe_token) {
      try {
        const templateRows = await sql`SELECT subject, html FROM email_templates WHERE name = 'waitlist'`;
        const tpl = templateRows[0];
        const unsubscribeLink = `${siteUrl}/api/unsubscribe?token=${sub.unsubscribe_token}`;
        const html = (tpl?.html || '<p>Estás en la lista de espera.</p>').replace(/\{\{unsubscribe_link\}\}/g, unsubscribeLink);
        const subject = tpl?.subject || 'PURSUE — Lista de espera';

        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.RESEND_FROM,
          to: email,
          subject,
          html,
        });
      } catch (err) {
        console.error('waitlist email error:', err.message);
        // No fallar el request si el email no sale
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('waitlist error:', err.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
