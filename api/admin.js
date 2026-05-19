import { neon } from '@neondatabase/serverless';

function checkAuth(req) {
  const authHeader = req.headers?.authorization || '';
  if (!authHeader.startsWith('Basic ')) return false;
  const encoded = authHeader.slice(6);
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const [user, pass] = decoded.split(':');
  return user === 'admin' && pass === process.env.ADMIN_PASSWORD;
}

function htmlPage(content) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Panel Admin | IRREDUCTIBLE</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  body { background:#131313; color:#e5e2e1; font-family:Inter,sans-serif; margin:0; padding:24px; }
  h1 { font-family:'Bebas Neue',sans-serif; font-size:28px; color:#ecc155; margin:0 0 24px; letter-spacing:0.05em; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th { font-family:'Bebas Neue',sans-serif; font-size:16px; color:#ecc155; text-align:left; padding:12px 16px; border-bottom:2px solid #4e4636; letter-spacing:0.05em; text-transform:uppercase; }
  td { padding:12px 16px; border-bottom:1px solid #2a2a2a; font-family:'JetBrains Mono',monospace; font-size:12px; }
  tr:hover td { background:#1c1b1b; }
  .status-active { color:#ecc155; }
  .status-unsubscribed { color:#9a907d; }
  .container { max-width:960px; margin:0 auto; }
  .count { font-family:'JetBrains Mono',monospace; font-size:12px; color:#9a907d; margin-bottom:16px; }
  a { color:#98ccf6; }
</style>
</head>
<body>
<div class="container">
  <h1>Panel Admin — Suscriptores</h1>
  ${content}
</div>
</body>
</html>`;
}

function renderTable(subscribers) {
  if (subscribers.length === 0) {
    return '<p style="color:#9a907d">No hay suscriptores aún.</p>';
  }

  let rows = '';
  for (const s of subscribers) {
    const statusClass = s.status === 'active' ? 'status-active' : 'status-unsubscribed';
    const leadSent = s.lead_magnet_sent_at
      ? new Date(s.lead_magnet_sent_at).toISOString().replace('T', ' ').substring(0, 19)
      : '—';
    const createdAt = new Date(s.created_at).toISOString().replace('T', ' ').substring(0, 19);

    const source = s.source || '—';

    rows += `<tr>
      <td>${s.email}</td>
      <td>${source}</td>
      <td class="${statusClass}">${s.status}</td>
      <td>${createdAt}</td>
      <td>${leadSent}</td>
    </tr>`;
  }

  return `<p class="count">${subscribers.length} suscriptor(es)</p>
<table>
  <thead><tr><th>Email</th><th>Source</th><th>Status</th><th>Creado</th><th>Lead Magnet</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

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

function editorForm(template) {
  const subject = template?.subject || '';
  const html = template?.html || '';
  return `<hr style="border:1px solid #4e4636;margin:32px 0">
<h2 style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#ecc155;margin:0 0 16px;letter-spacing:0.05em">Editor de Email de Bienvenida</h2>
<form method="POST" style="display:flex;flex-direction:column;gap:12px;max-width:600px">
  <input type="hidden" name="name" value="lead_magnet">
  <label style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#d1c5b0">Asunto</label>
  <input type="text" name="subject" value="${escapeHtml(subject)}" required
         style="background:transparent;border:1px solid #4e4636;color:#e5e2e1;padding:10px;font-family:Inter,sans-serif;font-size:14px">
  <label style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#d1c5b0">HTML (placeholders: {'{{'}lead_magnet_url{'}}'}, {'{{'}unsubscribe_link{'}}'})</label>
  <textarea name="html" rows="16" required
            style="background:transparent;border:1px solid #4e4636;color:#e5e2e1;padding:10px;font-family:'JetBrains Mono',monospace;font-size:12px;resize:vertical">${escapeHtml(html)}</textarea>
  <button type="submit"
          style="background:#ecc155;color:#131313;border:none;padding:12px 24px;font-family:'Bebas Neue',sans-serif;font-size:16px;cursor:pointer;letter-spacing:0.05em;align-self:flex-start">
    GUARDAR TEMPLATE
  </button>
</form>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!checkAuth(req)) {
    if (req.method === 'POST') {
      return res.status(401).json({ error: 'No autorizado' });
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="IRREDUCTIBLE Admin"');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(401).send(htmlPage('<p>Acceso restringido.</p>'));
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    if (req.method === 'POST') {
      let body;
      try { body = await parseBody(req); } catch {
        return res.status(400).json({ error: 'Body inválido' });
      }

      const name = (body.name || '').trim();
      const subject = (body.subject || '').trim();
      const html = (body.html || '').trim();

      if (!name || !subject || !html) {
        return res.status(400).json({ error: 'Faltan campos: name, subject, html' });
      }

      await sql`
        INSERT INTO email_templates (name, subject, html, updated_at)
        VALUES (${name}, ${subject}, ${html}, NOW())
        ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html = EXCLUDED.html, updated_at = NOW()
      `;

      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'GET') {
      return res.status(405).send('Method not allowed');
    }

    const [subscribers, templateRows] = await Promise.all([
      sql`SELECT email, source, status, created_at, lead_magnet_sent_at FROM subscribers ORDER BY created_at DESC`,
      sql`SELECT subject, html FROM email_templates WHERE name = 'lead_magnet'`,
    ]);

    const template = templateRows[0] || null;
    const content = renderTable(subscribers) + editorForm(template);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlPage(content));
  } catch (err) {
    console.error('admin error:', err.message);
    if (req.method === 'POST') {
      return res.status(500).json({ error: 'Error interno' });
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(htmlPage('<p>Error al cargar los datos.</p>'));
  }
}
