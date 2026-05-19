# CONTEXT-CLAUDE-CHAT.md — irreductible-site

> Pegar este archivo completo al inicio de una conversación nueva con Claude chat
> cuando necesites al Director Técnico para decisiones de arquitectura.
> Actualizado al completar Fase 1 y Fase 2.

---

## Proyecto

**Nombre:** irreductible-email
**Repo:** `irreductible-site` (local → GitHub → Vercel auto-deploy)
**URL producción:** https://irreductible.site
**Objetivo:** Reemplazar Systeme.io con sistema propio de captura + lead magnet + newsletter

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML + Vanilla JS estático |
| API | Vercel Serverless Functions — Node.js en `/api/*.js` |
| Base de datos | Neon PostgreSQL 17 — us-east-1 |
| Email | Resend |
| Deploy | Vercel Hobby (GitHub auto-deploy) |
| Assets | Cloudinary (ya existente) |
| CRON externo | cron-job.org |

---

## Estructura actual del repo

```
irreductible-site/
├── api/
│   ├── _lib/
│   │   ├── rate-limiter.js       # RateLimiter class (5 req / 15 min / IP)
│   │   └── email-validator.js    # validate(): RFC + disposable domains
│   ├── cron/
│   │   └── send-onboarding.js    # POST → envía secuencia de onboarding
│   ├── webhooks/
│   │   └── resend.js             # POST → procesa eventos Resend
│   ├── admin.js                  # GET/POST → panel admin protegido con Basic Auth
│   ├── subscribe.js              # POST → captura email, guarda en Neon, envía lead magnet
│   ├── unsubscribe.js            # GET → baja por token único
│   └── send-newsletter.js        # POST → envía newsletter a lista activa
├── assets/evidencia/             # imágenes FBI, NASA, etc.
├── config/
│   └── feature-flags.json        # email_system: true
├── evidencia/                    # páginas HTML de expedientes
├── scripts/
│   ├── schema.sql                # tabla subscribers
│   ├── schema_email_templates.sql
│   ├── schema_metrics.sql
│   ├── schema_onboarding.sql
│   ├── schema_source.sql
│   ├── test-schema.cjs
│   ├── test-config.cjs
│   ├── test-subscribe.cjs
│   ├── test-unsubscribe.cjs
│   ├── test-modal.cjs
│   ├── test-send-newsletter.cjs
│   ├── test-unsubscribe-link.cjs
│   ├── test-rate-limit.cjs
│   ├── test-admin.cjs
│   ├── test-email-template.cjs
│   ├── test-webhooks.cjs
│   ├── test-source.cjs
│   ├── test-email-validator.cjs
│   └── test-onboarding.cjs
├── index.html                    # landing principal con modal de suscripción
├── libro.html                    # página del libro
├── vercel.json                   # cleanUrls + CORS headers para /api/*
├── package.json                  # type: module + dependencias
├── CLAUDE.md
├── PRD.md
└── CONTEXT-CLAUDE-CHAT.md
```

---

## Estado del backlog — TODO COMPLETADO

### MVP — Fase 1

| Slice | Descripción | Estado |
|---|---|---|
| 1 | Schema Neon + package.json + vercel.json CORS | COMPLETADO |
| 2 | `POST /api/subscribe` | COMPLETADO |
| 3 | Formulario en `index.html` (modal) | COMPLETADO |
| 4 | `GET /api/unsubscribe` | COMPLETADO |
| 5 | `POST /api/send-newsletter` | COMPLETADO |
| 6 | Link de baja personalizado en emails | COMPLETADO |

### Fase 2 — Post MVP

| Slice | Descripción | Estado |
|---|---|---|
| Rate limiting | 5 req/15 min por IP en subscribe | COMPLETADO |
| Panel admin lista | GET /api/admin con Basic Auth, tabla suscriptores | COMPLETADO |
| Editor email bienvenida | Tabla email_templates, editor en admin, subscribe lee de DB | COMPLETADO |
| Métricas + webhooks | POST /api/webhooks/resend, bounces/complaints → baja auto | COMPLETADO |
| Parámetro source/tag | Columna source en subscribers, campo oculto en formulario | COMPLETADO |
| Secuencia onboarding | Tabla onboarding_emails, CRON endpoint, editor en admin | COMPLETADO |
| Validación de email | RFC + disposable-email-domains (121K dominios) | COMPLETADO |
| Editor WYSIWYG | Quill en panel admin para lead_magnet y onboarding | COMPLETADO |
| Fix parseBody | Soporta URL-encoded + JSON. Banner ?saved=1/?saved=error | COMPLETADO |
| ESM/CJS fix | package.json type: module, tests renombrados a .cjs | COMPLETADO |

---

## Variables de entorno

Configuradas en Vercel Dashboard. Para local: `.env.local`.

```
DATABASE_URL=           # Neon connection string (pooler)
RESEND_API_KEY=         # Resend API key
RESEND_FROM=            # PURSUE <pablobravo@acceso.irreductible.site>
LEAD_MAGNET_URL=        # URL Cloudinary del PDF
NEWSLETTER_API_KEY=     # Secret para autenticar pipeline y CRON
SITE_URL=               # https://irreductible.site
ADMIN_PASSWORD=         # Password para panel admin (Basic Auth)
```

---

## Configuración externa post-deploy

### cron-job.org
```
URL: https://irreductible.site/api/cron/send-onboarding
Método: POST
Header: x-api-key: [NEWSLETTER_API_KEY]
Schedule: cada hora (0 * * * *)
```

### Resend Dashboard
```
Webhook URL: https://irreductible.site/api/webhooks/resend
Eventos: email.opened, email.clicked, email.bounced, email.complained
```

---

## Tests

36 tests en total. Ejecutar suite completa:

```powershell
node scripts/test-schema.cjs
node scripts/test-config.cjs
node scripts/test-subscribe.cjs
node scripts/test-unsubscribe.cjs
node scripts/test-modal.cjs
node scripts/test-send-newsletter.cjs
node scripts/test-unsubscribe-link.cjs
node scripts/test-rate-limit.cjs
node scripts/test-admin.cjs
node scripts/test-email-template.cjs
node scripts/test-webhooks.cjs
node scripts/test-source.cjs
node scripts/test-email-validator.cjs
node scripts/test-onboarding.cjs
```

---

## Decisiones técnicas tomadas

| Decisión | Justificación |
|---|---|
| Vercel Serverless Functions | Mismo repo, mismo deploy, gratis en Hobby |
| Neon us-east-1 | Misma región que Vercel — mínima latencia |
| Sin framework en frontend | El sitio ya es HTML estático |
| Lotes de 50 en send-newsletter | Rate limits de Resend |
| UUID como unsubscribe_token | No predecible, seguro para links públicos |
| HTTP Basic Auth para admin | Sin framework de sesiones, suficiente para MVP |
| Rate limiting in-memory (Map) | Sin Redis, aceptable en serverless warm |
| CRON vía cron-job.org | Vercel Cron es solo Pro |
| Quill desde CDN | Sin build step, sin paquetes npm extra |
| createRequire para disposable-email-domains | Es un JSON, ESM requiere import assertion |
| Templates en DB con placeholders | `{{lead_magnet_url}}` y `{{unsubscribe_link}}` reemplazados en runtime |
| Svix verification pendiente (Fase 3) | Comentado en api/webhooks/resend.js |

---

## Pendiente Fase 3

- Verificación de firma Svix en webhooks (ubicación exacta marcada en código)
- Paginación en panel admin
- Edición/eliminación de onboarding emails existentes
- Panel de métricas separado (opens/clicks por email)
- Rate limiting en unsubscribe y send-newsletter
- Doble opt-in
