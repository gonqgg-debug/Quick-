-- Nacional (Supermercados Nacional) as a catalog photo source.

alter table public.products
  add column if not exists nacional_consultado_en timestamptz;

alter table public.product_image_suggestions
  drop constraint if exists product_image_suggestions_source_check;

alter table public.product_image_suggestions
  add constraint product_image_suggestions_source_check
    check (source in ('open_food_facts', 'web', 'upload', 'nacional'));
