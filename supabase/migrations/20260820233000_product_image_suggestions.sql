-- Product barcodes + human-confirmed photos + suggestion queue.

alter table public.products
  add column if not exists codigo_barras text;

alter table public.products
  add column if not exists foto_confirmada boolean not null default false;

alter table public.products
  add column if not exists off_consultado_en timestamptz;

update public.products
set foto_confirmada = true
where foto_url is not null
  and btrim(foto_url) <> ''
  and foto_confirmada = false;

update public.products
set codigo_barras = regexp_replace(codigo_odoo, '[^0-9]', '', 'g')
where codigo_barras is null
  and codigo_odoo is not null
  and regexp_replace(codigo_odoo, '[^0-9]', '', 'g') ~ '^[0-9]{8,14}$';

create table if not exists public.product_image_suggestions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  source text not null,
  image_url text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint product_image_suggestions_source_check
    check (source in ('open_food_facts', 'web', 'upload')),
  constraint product_image_suggestions_status_check
    check (status in ('pending', 'accepted', 'rejected'))
);

create unique index if not exists product_image_suggestions_pending_product
  on public.product_image_suggestions (product_id)
  where status = 'pending';

create index if not exists product_image_suggestions_product_id
  on public.product_image_suggestions (product_id);

revoke all on table public.product_image_suggestions from anon, authenticated, public;
grant all on table public.product_image_suggestions to service_role;

alter table public.product_image_suggestions enable row level security;
alter table public.product_image_suggestions force row level security;

drop policy if exists "service_role_product_image_suggestions_all" on public.product_image_suggestions;
create policy "service_role_product_image_suggestions_all"
  on public.product_image_suggestions
  for all
  to service_role
  using (true)
  with check (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('product-photos', 'product-photos', true, 5242880)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "product_photos_public_read" on storage.objects;
create policy "product_photos_public_read"
  on storage.objects
  for select
  using (bucket_id = 'product-photos');

drop policy if exists "product_photos_service_role" on storage.objects;
create policy "product_photos_service_role"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'product-photos')
  with check (bucket_id = 'product-photos');
