# CLAUDE.md — irreductible-site (Print Checkout Feature)

## Contexto del proyecto
Feature de checkout para venta del libro físico "IRREDUCTIBLE. La Anomalía Persistente".
Se agrega al repo Next.js existente. NO es un proyecto desde cero.

## Stack
- Next.js (App Router) + TypeScript
- Neon PostgreSQL (variable: DATABASE_URL — ya existe)
- Resend para emails (variable: RESEND_API_KEY — ya existe)
- Cloudinary para imágenes (ya existe, no tocar)
- Lulu Print API (variables: LULU_CLIENT_KEY, LULU_CLIENT_SECRET)
- PayPal Orders API v2 (variables: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
- Vercel (deploy automático desde main)

## Comandos de desarrollo
```bash
npm run dev       # servidor local
npm run build     # build de producción
npm run lint      # eslint
npm run typecheck # tsc --noEmit
```

## Variables de entorno requeridas para esta feature
```
LULU_CLIENT_KEY=
LULU_CLIENT_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
DATABASE_URL=         # ya existe
RESEND_API_KEY=       # ya existe
ADMIN_EMAIL=pablo@... # email donde Pablo recibe notificaciones de venta
```

## Constantes del libro (NO hardcodear en componentes — usar lib/constants.ts)
```typescript
BOOK_SKU         // SKU de 27 caracteres generado en Lulu Price Calculator
BOOK_PAGE_COUNT  // número de páginas del interior PDF
BOOK_TITLE       // "IRREDUCTIBLE. La Anomalía Persistente"
BOOK_AUTHOR      // "Pablo Bravo"
```

## Endpoints de Lulu API
- Producción: https://api.lulu.com
- Sandbox:    https://api.sandbox.lulu.com
- Auth:       https://api.lulu.com/auth/realms/glasstree/protocol/openid-connect/token
- Auth sandbox: https://api.sandbox.lulu.com/auth/realms/glasstree/protocol/openid-connect/token

## Autenticación Lulu
OAuth2 client_credentials. El token expira — renovar automáticamente en el cliente.
```
POST /auth/realms/glasstree/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded
Body: grant_type=client_credentials&client_id=KEY&client_secret=SECRET
```

## Endpoints de PayPal API
- Producción: https://api-m.paypal.com
- Sandbox:    https://api-m.sandbox.paypal.com

## Estructura de carpetas nueva
```
src/
  app/
    checkout/
      page.tsx
    api/
      lulu/
        calculate/route.ts
        create-print-job/route.ts
      paypal/
        create-order/route.ts
        capture-order/route.ts
  components/
    checkout/
      CheckoutForm.tsx
      ShippingForm.tsx
      CostBreakdown.tsx
      PayPalButton.tsx
  lib/
    lulu.ts
    paypal.ts
    constants.ts
db/
  migrations/
    001_create_orders.sql
```

## Naming conventions
- Componentes: PascalCase
- Funciones/variables: camelCase
- Archivos no-componente: kebab-case
- Variables de entorno: SCREAMING_SNAKE_CASE
- Constantes del libro: exportadas desde lib/constants.ts

## Reglas críticas
1. NUNCA exponer LULU_CLIENT_SECRET ni PAYPAL_CLIENT_SECRET al cliente
2. Toda llamada a Lulu API y PayPal API va server-side (API routes de Next.js)
3. El print job en Lulu se crea SOLO después de confirmar que el pago PayPal fue capturado
4. El estado de la orden en DB se actualiza antes de llamar a Lulu (para no perder la info si Lulu falla)
5. Máximo 200 líneas por slice — proponer sub-slices si se excede
6. No modificar archivos existentes fuera del scope sin autorización de Pablo

## Modelo tabla orders
Ver PRD.md sección "Modelo de datos"

## Feature flags
Cada slice agrega su entry en config/feature-flags.json con flag en false.
Pablo activa manualmente en producción.

## Referencia
Ver PRD.md para backlog completo, flujo y prerequisitos.
