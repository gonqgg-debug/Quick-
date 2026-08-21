-- Encuesta post-entrega: un feedback por pedido, disparada ~45 min después de Completada.

alter table public.orders
  add column if not exists completada_en timestamptz;

alter table public.orders
  add column if not exists feedback_solicitado_en timestamptz;

alter table public.chats
  add column if not exists feedback_comentario_order_id uuid references public.orders (id) on delete set null;

create table if not exists public.order_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  calificacion integer not null,
  comentario text,
  requiere_atencion boolean not null default false,
  created_at timestamptz not null default now(),
  constraint order_feedback_order_id_key unique (order_id),
  constraint order_feedback_calificacion_check check (calificacion >= 1 and calificacion <= 5)
);

create index if not exists idx_orders_feedback_due
  on public.orders (completada_en)
  where estado = 'completada'
    and feedback_solicitado_en is null
    and completada_en is not null;

create index if not exists idx_order_feedback_requiere_atencion
  on public.order_feedback (requiere_atencion)
  where requiere_atencion;

revoke all on table public.order_feedback from anon, authenticated, public;
grant all on table public.order_feedback to service_role;

alter table public.order_feedback enable row level security;
alter table public.order_feedback force row level security;

create policy "service_role_order_feedback_all"
  on public.order_feedback
  for all
  to service_role
  using (true)
  with check (true);
