-- WhatsApp inbound media (images, video, documents) stored in whatsapp_log + Storage.

alter table public.whatsapp_log
  add column if not exists tipo_contenido text not null default 'texto';

alter table public.whatsapp_log
  add column if not exists media_url text;

alter table public.whatsapp_log
  drop constraint if exists whatsapp_log_tipo_contenido_check;

alter table public.whatsapp_log
  add constraint whatsapp_log_tipo_contenido_check
  check (tipo_contenido in ('texto', 'imagen', 'video', 'documento'));

insert into storage.buckets (id, name, public, file_size_limit)
values ('whatsapp-media', 'whatsapp-media', false, 16777216)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit;

drop policy if exists "whatsapp_media_service_role" on storage.objects;

create policy "whatsapp_media_service_role"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'whatsapp-media')
  with check (bucket_id = 'whatsapp-media');
