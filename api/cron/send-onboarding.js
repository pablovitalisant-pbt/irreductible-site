// api/cron/send-onboarding.js
// Endpoint para CRON externo (cron-job.org)
//
// Configuración en cron-job.org:
//   URL: https://irreductible.site/api/cron/send-onboarding
//   Método: POST
//   Header: x-api-key: [NEWSLETTER_API_KEY]
//   Schedule: cada hora (0 * * * *)
//
// Sin la API key, el endpoint no hace nada — seguro para exponer.

import { neon } from '@neondatabase/serverless';
import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = (req.headers?.['x-api-key'] || '').trim();
  if (!apiKey || apiKey !== process.env.NEWSLETTER_API_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Obtener emails de onboarding activos, ordenados por delay
    const steps = await sql`
      SELECT id, subject, html, delay_hours
      FROM onboarding_emails
      WHERE active = true
      ORDER BY delay_hours ASC
    `;

    if (steps.length === 0) {
      return res.status(200).json({ processed: 0, sent: 0, skipped: 0 });
    }

    // Obtener suscriptores activos que no completaron la secuencia
    const subscribers = await sql`
      SELECT id, email, unsubscribe_token, created_at, onboarding_step
      FROM subscribers
      WHERE status = 'active'
        AND onboarding_step < ${steps.length}
    `;

    let sent = 0;
    let skipped = 0;
    const now = new Date();
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM;
    const siteUrl = process.env.SITE_URL || 'https://irreductible.site';

    for (const sub of subscribers) {
      const nextStepIndex = sub.onboarding_step; // 0-indexed, step 0 = primer email pendiente
      const step = steps[nextStepIndex];

      if (!step) { skipped++; continue; }

      const hoursSinceCreated = (now - new Date(sub.created_at)) / (1000 * 60 * 60);
      if (hoursSinceCreated < step.delay_hours) { skipped++; continue; }

      try {
        const unsubscribeLink = `${siteUrl}/api/unsubscribe?token=${sub.unsubscribe_token}`;
        const personalizedHtml = step.html.replace(/\{\{unsubscribe_link\}\}/g, unsubscribeLink);

        await resend.emails.send({
          from,
          to: sub.email,
          subject: step.subject,
          html: personalizedHtml,
        });

        await sql`
          UPDATE subscribers
          SET onboarding_step = onboarding_step + 1
          WHERE id = ${sub.id}
        `;

        sent++;
      } catch (err) {
        console.error(`onboarding send error for ${sub.email.substring(0, 3)}***:`, err.message);
        skipped++;
      }
    }

    return res.status(200).json({ processed: subscribers.length, sent, skipped });
  } catch (err) {
    console.error('cron onboarding error:', err.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
