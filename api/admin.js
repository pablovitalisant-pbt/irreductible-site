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
<link href="https://cdn.quilljs.com/1.3.7/quill.snow.css" rel="stylesheet">
<script src="https://cdn.quilljs.com/1.3.7/quill.min.js"></script>
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
  .ql-toolbar.ql-snow { border-color:#4e4636; background:#1c1b1b; }
  .ql-container.ql-snow { border-color:#4e4636; background:#131313; color:#e5e2e1; font-family:Inter,sans-serif; font-size:14px; min-height:200px; }
  .ql-editor { min-height:200px; }
  .ql-snow .ql-stroke { stroke:#9a907d; }
  .ql-snow .ql-fill { fill:#9a907d; }
  .ql-snow .ql-picker { color:#9a907d; }
  .ql-snow .ql-picker-options { background:#1c1b1b; border-color:#4e4636; }
</style>
</head>
<body>
<div class="container">
  <h1>Panel Admin — Suscriptores</h1>
  ${content}
</div>
<script>
(function() {
  var quills = {};
  document.querySelectorAll('.ql-editor-container').forEach(function(div) {
    var editorId = div.id;
    var hiddenId = div.getAttribute('data-hidden');
    var q = new Quill('#' + editorId, {
      theme: 'snow',
      modules: { toolbar: [['bold','italic','link'], [{ list: 'bullet' }, { list: 'ordered' }], ['clean']] }
    });
    quills[editorId] = { quill: q, hiddenId: hiddenId };
  });

  document.querySelectorAll('.editor-form').forEach(function(form) {
    form.addEventListener('submit', function() {
      Object.keys(quills).forEach(function(id) {
        var entry = quills[id];
        var hidden = document.getElementById(entry.hiddenId);
        if (hidden && form.contains(document.getElementById(id))) {
          hidden.value = entry.quill.root.innerHTML;
        }
      });
    });
  });
})();
</script>
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
    const tags = (s.tags || []).join(', ') || '—';

    rows += `<tr>
      <td>${s.email}</td>
      <td>${source}</td>
      <td>${escapeHtml(tags)}</td>
      <td class="${statusClass}">${s.status}</td>
      <td>${createdAt}</td>
      <td>${leadSent}</td>
    </tr>`;
  }

  return `<p class="count">${subscribers.length} suscriptor(es)</p>
<table>
  <thead><tr><th>Email</th><th>Source</th><th>Tags</th><th>Status</th><th>Creado</th><th>Lead Magnet</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        const trimmed = data.trim();
        if (trimmed.startsWith('{')) {
          resolve(JSON.parse(data));
        } else if (trimmed) {
          const params = new URLSearchParams(trimmed);
          const obj = {};
          params.forEach((value, key) => { obj[key] = value; });
          resolve(obj);
        } else {
          resolve({});
        }
      } catch { reject(new Error('Body inválido')); }
    });
    req.on('error', reject);
  });
}

function editorForm(template) {
  const subject = template?.subject || '';
  const html = template?.html || '';
  return `<hr style="border:1px solid #4e4636;margin:32px 0">
<h2 style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#ecc155;margin:0 0 16px;letter-spacing:0.05em">Editor de Email de Bienvenida</h2>
<form method="POST" class="editor-form" style="display:flex;flex-direction:column;gap:12px;max-width:600px">
  <input type="hidden" name="name" value="lead_magnet">
  <label style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#d1c5b0">Asunto</label>
  <input type="text" name="subject" value="${escapeHtml(subject)}" required
         style="background:transparent;border:1px solid #4e4636;color:#e5e2e1;padding:10px;font-family:Inter,sans-serif;font-size:14px">
  <label style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#d1c5b0">HTML (placeholders: {'{{'}lead_magnet_url{'}}'}, {'{{'}unsubscribe_link{'}}'})</label>
  <input type="hidden" name="html" id="html-lead-magnet">
  <div id="editor-lead-magnet" class="ql-editor-container" data-hidden="html-lead-magnet">${html}</div>
  <button type="submit"
          style="background:#ecc155;color:#131313;border:none;padding:12px 24px;font-family:'Bebas Neue',sans-serif;font-size:16px;cursor:pointer;letter-spacing:0.05em;align-self:flex-start">
    GUARDAR TEMPLATE
  </button>
</form>`;
}

function onboardingEditor(steps) {
  let rows = '';
  for (const s of steps) {
    rows += `<tr>
      <td>${s.delay_hours}h</td>
      <td>${escapeHtml(s.subject)}</td>
      <td style="color:${s.active ? '#ecc155' : '#9a907d'}">${s.active ? 'ACTIVO' : 'INACTIVO'}</td>
    </tr>`;
  }

  return `<hr style="border:1px solid #4e4636;margin:32px 0">
<h2 style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#ecc155;margin:0 0 16px;letter-spacing:0.05em">Secuencia de Onboarding</h2>
${steps.length > 0 ? `<table style="margin-bottom:24px">
  <thead><tr><th>Delay</th><th>Asunto</th><th>Estado</th></tr></thead>
  <tbody>${rows}</tbody>
</table>` : '<p style="color:#9a907d;margin-bottom:24px">Sin emails de onboarding. Agregá el primero.</p>'}
<form method="POST" class="editor-form" style="display:flex;flex-direction:column;gap:12px;max-width:600px">
  <input type="hidden" name="action" value="save_onboarding">
  <label style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#d1c5b0">Delay (horas tras suscripción)</label>
  <input type="number" name="delay_hours" value="24" min="1" required
         style="background:transparent;border:1px solid #4e4636;color:#e5e2e1;padding:10px;font-family:Inter,sans-serif;font-size:14px;width:100px">
  <label style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#d1c5b0">Asunto</label>
  <input type="text" name="subject" required
         style="background:transparent;border:1px solid #4e4636;color:#e5e2e1;padding:10px;font-family:Inter,sans-serif;font-size:14px">
  <label style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#d1c5b0">HTML (placeholder: {'{{'}unsubscribe_link{'}}'})</label>
  <input type="hidden" name="html" id="html-onboarding">
  <div id="editor-onboarding" class="ql-editor-container" data-hidden="html-onboarding"></div>
  <button type="submit"
          style="background:#ecc155;color:#131313;border:none;padding:12px 24px;font-family:'Bebas Neue',sans-serif;font-size:16px;cursor:pointer;letter-spacing:0.05em;align-self:flex-start">
    AGREGAR EMAIL
  </button>
</form>
<p style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#9a907d;margin-top:16px">CRON externo: configurar en cron-job.org — POST a /api/cron/send-onboarding con header x-api-key cada hora.</p>`;
}

function savedBanner(param) {
  if (param === '1') {
    return '<div style="background:#1a3a1a;border:1px solid #2d6a2d;color:#98ccf6;padding:12px 16px;margin-bottom:16px;font-family:Inter,sans-serif;font-size:14px">Template guardado correctamente.</div>';
  }
  if (param === 'error') {
    return '<div style="background:#3a1a1a;border:1px solid #6a2d2d;color:#ffb4ab;padding:12px 16px;margin-bottom:16px;font-family:Inter,sans-serif;font-size:14px">Error al guardar. Intenta de nuevo.</div>';
  }
  return '';
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

      const action = (body.action || '').trim();

      if (action === 'save_onboarding') {
        const subject = (body.subject || '').trim();
        const html = (body.html || '').trim();
        const delayHours = parseInt(body.delay_hours, 10);
        const active = body.active !== 'false';

        if (!subject || !html || isNaN(delayHours) || delayHours < 1) {
          return res.status(400).json({ error: 'Faltan campos: subject, html, delay_hours' });
        }

        await sql`
          INSERT INTO onboarding_emails (subject, html, delay_hours, active, updated_at)
          VALUES (${subject}, ${html}, ${delayHours}, ${active}, NOW())
        `;

        res.setHeader('Location', '/api/admin?saved=1');
        return res.status(302).end();
      }

      // save_template (default)
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

      console.log('save_template: name=' + name + ' subject=' + subject + ' html_len=' + html.length);
      await sql`
        INSERT INTO email_templates (name, subject, html, updated_at)
        VALUES (${name}, ${subject}, ${html}, NOW())
        ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html = EXCLUDED.html, updated_at = NOW()
      `;
      console.log('save_template: guardado OK');

      res.setHeader('Location', '/api/admin?saved=1');
      return res.status(302).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).send('Method not allowed');
    }

    const [subscribers, templateRows, onboardingSteps] = await Promise.all([
      sql`SELECT email, source, tags, status, created_at, lead_magnet_sent_at FROM subscribers ORDER BY created_at DESC`,
      sql`SELECT subject, html FROM email_templates WHERE name = 'lead_magnet'`,
      sql`SELECT id, subject, delay_hours, active FROM onboarding_emails ORDER BY delay_hours ASC`,
    ]);

    const url = new URL(req.url || '/', 'https://irreductible.site');
    const saved = url.searchParams.get('saved') || '';

    const template = templateRows[0] || null;
    const content = savedBanner(saved) + renderTable(subscribers) + editorForm(template) + onboardingEditor(onboardingSteps);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlPage(content));
  } catch (err) {
    console.error('admin error:', err.message);
    if (req.method === 'POST') {
      res.setHeader('Location', '/api/admin?saved=error');
      return res.status(302).end();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(htmlPage('<p>Error al cargar los datos.</p>'));
  }
}
