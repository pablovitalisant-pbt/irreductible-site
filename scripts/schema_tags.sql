ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

INSERT INTO email_templates (name, subject, html) VALUES (
  'waitlist',
  'PURSUE — Lista de espera',
  '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head><body style="background:#131313;color:#e5e2e1;font-family:Inter,sans-serif;padding:40px 20px;text-align:center"><h1 style="font-family:Bebas Neue,sans-serif;color:#ecc155;font-size:28px;margin-bottom:16px">PURSUE</h1><p style="font-size:16px;margin-bottom:24px">Estas en la lista de espera del libro. Te avisaremos cuando este disponible.</p><p style="font-size:12px;color:#d1c5b0;margin-top:32px">Si no solicitaste este correo, <a href="{{unsubscribe_link}}" style="color:#98ccf6">date de baja aqui</a>.</p></body></html>'
) ON CONFLICT (name) DO NOTHING;
