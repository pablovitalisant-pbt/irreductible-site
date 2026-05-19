CREATE TABLE IF NOT EXISTS email_templates (
  name       VARCHAR(50) PRIMARY KEY,
  subject    VARCHAR(255) NOT NULL,
  html       TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO email_templates (name, subject, html) VALUES (
  'lead_magnet',
  'PURSUE — Declassified Dossier',
  '<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="background:#131313;color:#e5e2e1;font-family:Inter,sans-serif;padding:40px 20px;text-align:center">
  <h1 style="font-family:''Bebas Neue'',sans-serif;color:#ecc155;font-size:28px;margin-bottom:16px">PURSUE</h1>
  <p style="font-size:16px;margin-bottom:24px">Gracias por suscribirte. Tu dossier desclasificado está listo.</p>
  <a href="{{lead_magnet_url}}" style="display:inline-block;background:#ecc155;color:#131313;padding:14px 28px;text-decoration:none;font-weight:700;font-size:16px">DESCARGAR DOSSIER</a>
  <p style="font-size:12px;color:#d1c5b0;margin-top:32px">Si no solicitaste este correo, <a href="{{unsubscribe_link}}" style="color:#98ccf6">date de baja aquí</a>.</p>
</body>
</html>'
) ON CONFLICT (name) DO NOTHING;
