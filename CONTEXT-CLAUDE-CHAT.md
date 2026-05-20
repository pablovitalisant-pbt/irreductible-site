# CONTEXT — irreductible-site / Print Checkout Feature

## Proyecto
Checkout para venta del libro físico "IRREDUCTIBLE. La Anomalía Persistente" (Pablo Bravo).
Feature que se agrega al repo Next.js existente `irreductible-site`.

## Repo
- Local: `C:\Users\pablo\Documents\libro-uap\website\irreductible-site`
- GitHub: https://github.com/pablovitalisant-pbt/irreductible-site.git
- Deploy: Vercel (auto-deploy desde main)

## Stack
- Next.js (App Router) + TypeScript
- Neon PostgreSQL (DATABASE_URL ya configurado)
- Resend (RESEND_API_KEY ya configurado)
- Cloudinary (ya configurado, no tocar)
- **Lulu Print API** — impresión y fulfillment (NUEVO)
- **PayPal Orders API v2** — cobro al cliente en USD (NUEVO)

## Secrets nuevos a agregar
```
LULU_CLIENT_KEY
LULU_CLIENT_SECRET
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
ADMIN_EMAIL
```

## Prerequisitos (estado actual)
- [ ] Cuenta en developers.lulu.com + tarjeta Visa registrada + SKU del libro
- [ ] App en developer.paypal.com + credenciales sandbox y producción
- [ ] PDF interior y portada del libro subidos a Lulu

## Estado del backlog
### Completado
- (ninguno aún)

### Pendiente
- SLICE-01: Página `/checkout` con formulario
- SLICE-02: API route `POST /api/lulu/calculate`
- SLICE-03: API route `POST /api/paypal/create-order`
- SLICE-04: API route `POST /api/paypal/capture-order`
- SLICE-05: API route `POST /api/lulu/create-print-job`
- SLICE-06: Tabla `orders` en Neon + persistencia
- SLICE-07: Emails confirmación (Resend)

## Último slice completado
Ninguno — proyecto recién iniciado.

## Decisiones técnicas tomadas
- Cobro en USD únicamente (PayPal)
- Lulu carga tarjeta de débito Visa de Pablo por cada print job
- Print job se crea SOLO después de capturar el pago PayPal
- Estado de la orden se guarda en DB antes de llamar a Lulu
- Toda la comunicación con Lulu y PayPal va server-side (nunca exponer secrets al cliente)

## Cómo actualizar este archivo
Cada vez que se completa un slice, mover el ítem de "Pendiente" a "Completado"
y actualizar "Último slice completado". Pegar el contenido actualizado al inicio
de una nueva conversación con Claude chat para retomar el contexto.
