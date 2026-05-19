import { neon } from '@neondatabase/serverless';

// FASE 3 — PENDIENTE: verificación de firma Svix
// Ubicación exacta: después de parsear el body, antes de procesar el evento.
// Pasos a implementar:
//   1. Leer svix-id, svix-timestamp, svix-signature de req.headers
//   2. Obtener secret desde process.env.RESEND_WEBHOOK_SECRET
//   3. Construir signedContent = `${svixId}.${svixTimestamp}.${JSON.stringify(body)}`
//   4. Verificar con crypto.createHmac('sha256', secret).update(signedContent).digest('base64')
//   5. Comparar en tiempo constante con svix-signature
//   6. Si no coinciden → 401
// Ver: https://resend.com/docs/dashboard/webhooks/security
const SVIX_VERIFICATION_PENDING = true;

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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const svixId = (req.headers?.['svix-id'] || '').trim();
  if (!svixId) {
    return res.status(400).json({ error: 'Falta header svix-id' });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return res.status(400).json({ error: 'Body inválido' });
  }

  // === FASE 3: insertar verificación de firma Svix aquí ===
  // Ver comentario al inicio del archivo para los pasos exactos.

  const eventType = body.type;
  const to = (body.data?.to || '').trim().toLowerCase();

  if (!to) {
    return res.status(400).json({ error: 'Falta email destinatario' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // FIXME: P2 — La búsqueda por email en tabla de 50K+ rows sin índice
    // de texto completo puede degradar. Agregar índice si crece.
    switch (eventType) {
      case 'email.opened':
        await sql`UPDATE subscribers SET opens = opens + 1 WHERE email = ${to}`;
        break;
      case 'email.clicked':
        await sql`UPDATE subscribers SET clicks = clicks + 1 WHERE email = ${to}`;
        break;
      case 'email.bounced':
        await sql`
          UPDATE subscribers
          SET status = 'unsubscribed', unsubscribed_reason = 'bounced', unsubscribed_at = NOW()
          WHERE email = ${to}
        `;
        break;
      case 'email.complained':
        await sql`
          UPDATE subscribers
          SET status = 'unsubscribed', unsubscribed_reason = 'complained', unsubscribed_at = NOW()
          WHERE email = ${to}
        `;
        break;
      default:
        // Eventos no soportados (email.sent, email.delivered, etc.) — ignorar
        break;
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('webhook error:', err.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
