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

    rows += `<tr>
      <td>${s.email}</td>
      <td class="${statusClass}">${s.status}</td>
      <td>${createdAt}</td>
      <td>${leadSent}</td>
    </tr>`;
  }

  return `<p class="count">${subscribers.length} suscriptor(es)</p>
<table>
  <thead><tr><th>Email</th><th>Status</th><th>Creado</th><th>Lead Magnet</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  if (!checkAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="IRREDUCTIBLE Admin"');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(401).send(htmlPage('<p>Acceso restringido.</p>'));
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const subscribers = await sql`
      SELECT email, status, created_at, lead_magnet_sent_at
      FROM subscribers
      ORDER BY created_at DESC
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlPage(renderTable(subscribers)));
  } catch (err) {
    console.error('admin error:', err.message);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(htmlPage('<p>Error al cargar los datos.</p>'));
  }
}
