alter table public.chats
  add column if not exists mensaje_pendiente boolean not null default false;
