alter table public.products
  add column if not exists web_consultado_en timestamptz;
