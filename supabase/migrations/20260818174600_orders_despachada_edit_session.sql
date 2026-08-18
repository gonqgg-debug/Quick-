-- orders.estado: agregar 'despachada' entre confirmada y completada.
-- order_sessions: sesión de edición opcional (edit_order_id).

alter table public.orders
  drop constraint if exists orders_estado_check;

alter table public.orders
  add constraint orders_estado_check
  check (
    estado = any (array[
      'nueva',
      'en_proceso',
      'faltante_reportado',
      'confirmada',
      'despachada',
      'completada',
      'cancelada'
    ])
  );

alter table public.order_sessions
  add column if not exists edit_order_id uuid references public.orders (id);
