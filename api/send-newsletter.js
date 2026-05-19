import { neon } from '@neondatabase/serverless';
import { Resend } from 'resend';

const BATCH_SIZE = 50;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function unsubscribeFooter(unsubscribeToken) {
  const baseUrl = process.env.SITE_URL || 'https://irreductible.site';
  const link = `${baseUrl}/api/unsubscribe?token=${unsubscribeToken}`;
  return {
    html: `<hr style="border:1px solid #4e4636;margin:24px 0"><p style="font-size:12px;color:#9a907d;font-family:JetBrains Mono,monospace">Estás recibiendo este correo como suscriptor de PURSUE. <a href="${link}" style="color:#98ccf6">Darte de baja</a>.</p>`,
    text: `\n\n---\nEstás recibiendo este correo como suscriptor de PURSUE. Para darte de baja: ${link}`,
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = (req.headers['x-api-key'] || '').trim();
  if (!apiKey || apiKey !== process.env.NEWSLETTER_API_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return res.status(400).json({ error: 'Body inválido' });
  }

  const subject = (body.subject || '').trim();
  const html = (body.html || '').trim();
  const text = (body.text || '').trim();

  if (!subject || !html || !text) {
    return res.status(400).json({ error: 'Faltan campos requeridos: subject, html, text' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    const subscribers = await sql`
      SELECT email, unsubscribe_token
      FROM subscribers
      WHERE status = 'active'
    `;

    if (subscribers.length === 0) {
      return res.status(200).json({ sent: 0, failed: 0 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM;

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((sub) => {
          const footer = unsubscribeFooter(sub.unsubscribe_token);
          return resend.emails.send({
            from,
            to: sub.email,
            subject,
            html: html + footer.html,
            text: text + footer.text,
          });
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled') sent++;
        else { failed++; console.error('send error:', r.reason?.message); }
      }
    }

    return res.status(200).json({ sent, failed });
  } catch (err) {
    console.error('send-newsletter error:', err.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
