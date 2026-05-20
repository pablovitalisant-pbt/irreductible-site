# PRD — Irreductible Print Checkout

## Descripción
Feature que se agrega al repo existente `irreductible-site`. Permite a cualquier persona
en el mundo comprar el libro físico "IRREDUCTIBLE. La Anomalía Persistente" de Pablo Bravo,
pagar con PayPal en USD, y recibir el libro impreso y despachado directamente por Lulu
a su dirección de envío.

## Usuarios
- **Comprador:** accede al checkout, elige cantidad, ingresa dirección, ve el costo total
  exacto (impresión + fulfillment + envío), paga con PayPal, recibe confirmación por email.
- **Pablo (admin):** recibe notificación por email de cada venta. El dinero entra a su
  cuenta PayPal. Lulu carga su tarjeta de débito registrada en la API.

## Flujo completo
1. Comprador llega al checkout (desde la landing `/libro/` o link directo)
2. Elige cantidad de unidades
3. Ingresa dirección de envío (calle, ciudad, país, código postal, teléfono)
4. Elige opción de envío (Mail, Priority Mail, Ground, Expedited, Express — según disponibilidad para el país)
5. El sistema llama a Lulu API en tiempo real y muestra desglose exacto:
   - Costo de impresión por unidad
   - Fulfillment fee fijo (USD 0.75)
   - Costo de envío
   - **Total a pagar**
6. Comprador hace click en "Pagar con PayPal"
7. PayPal procesa el pago (USD)
8. Si el pago es exitoso:
   - Se crea el Print Job en Lulu API (Lulu imprime y despacha)
   - Se guarda la orden en Neon DB
   - Se envía email de confirmación al comprador (Resend)
   - Se envía notificación de venta a Pablo (Resend)
9. Lulu despacha el libro a la dirección del comprador

## Stack
- **Framework:** Next.js (repo existente)
- **Pagos:** PayPal Orders API v2 (server-side, USD)
- **Fulfillment:** Lulu Print API
- **DB:** Neon PostgreSQL — tabla `orders` nueva
- **Emails:** Resend (ya configurado)
- **Deploy:** Vercel (ya configurado)

## Secrets nuevos requeridos
```
LULU_CLIENT_KEY=
LULU_CLIENT_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
```

## Backlog priorizado

### MVP (Fase 1)
- [ ] SLICE-01: Página `/checkout` con formulario (cantidad + dirección + opción de envío)
- [ ] SLICE-02: API route `POST /api/lulu/calculate` — llama a Lulu y retorna desglose de costos
- [ ] SLICE-03: API route `POST /api/paypal/create-order` — crea orden PayPal con monto exacto
- [ ] SLICE-04: API route `POST /api/paypal/capture-order` — captura el pago aprobado
- [ ] SLICE-05: API route `POST /api/lulu/create-print-job` — crea el print job en Lulu (post-pago)
- [ ] SLICE-06: Tabla `orders` en Neon + persistencia del estado de la orden
- [ ] SLICE-07: Emails de confirmación al comprador y notificación a Pablo (Resend)

### Fase 2 (post-MVP)
- [ ] Página de confirmación con tracking number cuando Lulu despacha (webhook)
- [ ] Panel admin simple para ver listado de órdenes
- [ ] Soporte multi-libro (cuando haya Libro 2)

## Prerequisitos (antes de codear)
1. Crear cuenta en developers.lulu.com, registrar tarjeta de débito Visa, obtener
   LULU_CLIENT_KEY y LULU_CLIENT_SECRET
2. Subir PDF interior + PDF portada a Lulu, obtener el SKU de 27 caracteres del libro
3. Crear app en developer.paypal.com, obtener PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET

## Estructura de carpetas nueva (dentro del repo existente)
```
src/
  app/
    checkout/
      page.tsx           # Página checkout
    api/
      lulu/
        calculate/
          route.ts       # Calcula costos en tiempo real
        create-print-job/
          route.ts       # Crea print job post-pago
      paypal/
        create-order/
          route.ts       # Crea orden PayPal
        capture-order/
          route.ts       # Captura pago
  components/
    checkout/
      CheckoutForm.tsx
      ShippingForm.tsx
      CostBreakdown.tsx
      PayPalButton.tsx
  lib/
    lulu.ts              # Cliente Lulu API
    paypal.ts            # Cliente PayPal API
db/
  migrations/
    001_create_orders.sql
```

## Modelo de datos — tabla `orders`
```sql
CREATE TABLE orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paypal_order_id    TEXT NOT NULL,
  lulu_print_job_id  TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'paid' | 'print_submitted' | 'in_production' | 'shipped' | 'failed'
  quantity      INTEGER NOT NULL,
  unit_price_usd     NUMERIC(10,2) NOT NULL,
  shipping_usd  NUMERIC(10,2) NOT NULL,
  fulfillment_fee_usd NUMERIC(10,2) NOT NULL DEFAULT 0.75,
  total_usd     NUMERIC(10,2) NOT NULL,
  buyer_email   TEXT NOT NULL,
  buyer_name    TEXT NOT NULL,
  shipping_address   JSONB NOT NULL,
  shipping_option    TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```
