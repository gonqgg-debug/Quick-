-- Monto en efectivo con el que el cliente va a pagar, para calcular el cambio.
alter table public.orders
  add column if not exists pago_con numeric;
