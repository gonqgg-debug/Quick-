alter table public.chats
  add column if not exists esperando_humano boolean not null default false;

alter table public.chats
  add column if not exists esperando_humano_desde timestamptz;
