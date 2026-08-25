alter table public.chats
  add column if not exists acepta_marketing boolean not null default false;
