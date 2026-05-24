-- 002_add_tracking_to_orders.sql
-- Agrega columnas de tracking para eventos shipment.shipped de Lulu

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_lulu_print_job_id ON orders(lulu_print_job_id);
