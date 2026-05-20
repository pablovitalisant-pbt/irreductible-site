-- 001_create_orders.sql
-- Tabla de órdenes para el checkout del libro físico
-- Status: pending → paid → print_submitted → in_production → shipped
--         puede ir a 'failed' desde cualquier estado

CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paypal_order_id   TEXT NOT NULL,
  lulu_print_job_id TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  quantity          INTEGER NOT NULL,
  unit_price_usd    NUMERIC(10,2) NOT NULL,
  shipping_usd      NUMERIC(10,2) NOT NULL,
  fulfillment_fee_usd NUMERIC(10,2) NOT NULL DEFAULT 0.75,
  total_usd         NUMERIC(10,2) NOT NULL,
  buyer_email       TEXT NOT NULL,
  buyer_name        TEXT NOT NULL,
  shipping_address  JSONB NOT NULL,
  shipping_option   TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_paypal_id ON orders(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
