import { neon } from '@neondatabase/serverless';
import { Resend } from 'resend';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return res.status(400).json({ error: 'Body inválido' });
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    const result = await sql`
      INSERT INTO subscribers (email)
      VALUES (${email})
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(409).json({ error: 'Email ya registrado' });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: email,
      subject: 'PURSUE — Declassified Dossier',
      html: leadMagnetEmail(),
    });

    await sql`
      UPDATE subscribers
      SET lead_magnet_sent_at = NOW()
      WHERE email = ${email}
    `;

    return res.status(200).json({ ok: true, message: 'Lead magnet enviado' });
  } catch (err) {
    console.error('subscribe error:', err.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}

function leadMagnetEmail() {
  const url = process.env.LEAD_MAGNET_URL;
  const siteUrl = process.env.SITE_URL;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="background:#131313;color:#e5e2e1;font-family:Inter,sans-serif;padding:40px 20px;text-align:center">
  <h1 style="font-family:'Bebas Neue',sans-serif;color:#ecc155;font-size:28px;margin-bottom:16px">PURSUE</h1>
  <p style="font-size:16px;margin-bottom:24px">Gracias por suscribirte. Tu dossier desclasificado está listo.</p>
  <a href="${url}" style="display:inline-block;background:#ecc155;color:#131313;padding:14px 28px;text-decoration:none;font-weight:700;font-size:16px">DESCARGAR DOSSIER</a>
  <p style="font-size:12px;color:#d1c5b0;margin-top:32px">Si no solicitaste este correo, <a href="${siteUrl}/api/unsubscribe" style="color:#98ccf6">date de baja aquí</a>.</p>
</body>
</html>`;
}
