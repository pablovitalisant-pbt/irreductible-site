import { neon } from '@neondatabase/serverless';
import { parse } from 'url';

function htmlPage(title, message, extra = '') {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} | IRREDUCTIBLE</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  body { background:#131313; color:#e5e2e1; font-family:Inter,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:24px; }
  .card { max-width:480px; width:100%; border:1px solid #4e4636; padding:40px 32px; text-align:center; }
  h1 { font-family:'Bebas Neue',sans-serif; font-size:28px; color:#ecc155; margin:0 0 16px; letter-spacing:0.05em; }
  p { font-size:16px; margin:0 0 8px; line-height:1.6; }
  .meta { font-family:'JetBrains Mono',monospace; font-size:12px; color:#9a907d; margin-top:24px; letter-spacing:0.1em; }
  a { color:#98ccf6; }
</style>
</head>
<body>
<div class="card">
  <h1>${title}</h1>
  <p>${message}</p>
  ${extra}
  <p class="meta">IRREDUCTIBLE &copy; 2026</p>
</div>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(405).send(htmlPage('Método no permitido', 'Esta URL solo acepta solicitudes GET.'));
  }

  const { query } = parse(req.url || '', true);
  const token = (query.token || '').trim();

  if (!token) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(htmlPage('Solicitud inválida', 'Falta el token de baja. Si llegaste aquí desde un email, asegúrate de usar el enlace completo.'));
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      SELECT id, email, status
      FROM subscribers
      WHERE unsubscribe_token = ${token}
    `;

    if (rows.length === 0) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(htmlPage('Token no válido', 'Este enlace de baja no corresponde a ningún suscriptor activo. Es posible que el token haya expirado o que ya te hayas dado de baja.'));
    }

    const sub = rows[0];

    if (sub.status === 'unsubscribed') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(htmlPage('Ya estás dado de baja', 'Tu suscripción ya estaba desactivada. No recibirás más correos de nuestra parte.'));
    }

    await sql`
      UPDATE subscribers
      SET status = 'unsubscribed', unsubscribed_at = NOW()
      WHERE id = ${sub.id}
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlPage('Te diste de baja', 'Tu suscripción ha sido desactivada. No recibirás más correos de PURSUE.', '<p style="margin-top:8px;font-size:14px;color:#d1c5b0;">Si cambias de opinión, puedes volver a suscribirte en <a href="https://irreductible.site">irreductible.site</a>.</p>'));
  } catch (err) {
    console.error('unsubscribe error:', err.message);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(htmlPage('Error', 'Ocurrió un error al procesar tu solicitud. Intenta de nuevo en unos minutos.'));
  }
}
