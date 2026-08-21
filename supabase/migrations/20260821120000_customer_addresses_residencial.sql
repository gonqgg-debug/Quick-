-- Direcciones estructuradas por complejo residencial.
-- `direccion` se mantiene como texto combinado para pedidos, staff y WhatsApp.

alter table public.customer_addresses
  add column if not exists residencial text,
  add column if not exists edificio text,
  add column if not exists apartamento text;
