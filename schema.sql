
create extension if not exists pgcrypto;

create table if not exists public.chats (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null default 'New chat',
    model text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.messages (
    id bigint generated always as identity primary key,
    chat_id uuid not null references public.chats(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.user_memory (
    user_id uuid primary key references auth.users(id) on delete cascade,
    content text not null default '',
    updated_at timestamptz not null default now()
);

create index if not exists chats_user_id_idx
on public.chats(user_id);

create index if not exists messages_chat_id_idx
on public.messages(chat_id);

create index if not exists messages_user_id_idx
on public.messages(user_id);

alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.user_memory enable row level security;

drop policy if exists "chat_select_own" on public.chats;
create policy "chat_select_own" on public.chats
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "chat_insert_own" on public.chats;
create policy "chat_insert_own" on public.chats
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "chat_update_own" on public.chats;
create policy "chat_update_own" on public.chats
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "chat_delete_own" on public.chats;
create policy "chat_delete_own" on public.chats
for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "message_select_own" on public.messages;
create policy "message_select_own" on public.messages
for select to authenticated
using (
    auth.uid() = user_id
    and exists (
        select 1 from public.chats c
        where c.id = messages.chat_id
        and c.user_id = auth.uid()
    )
);

drop policy if exists "message_insert_own" on public.messages;
create policy "message_insert_own" on public.messages
for insert to authenticated
with check (
    auth.uid() = user_id
    and exists (
        select 1 from public.chats c
        where c.id = messages.chat_id
        and c.user_id = auth.uid()
    )
);

drop policy if exists "memory_select_own" on public.user_memory;
create policy "memory_select_own" on public.user_memory
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "memory_insert_own" on public.user_memory;
create policy "memory_insert_own" on public.user_memory
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "memory_update_own" on public.user_memory;
create policy "memory_update_own" on public.user_memory
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant usage on schema public to authenticated;

grant select, insert, update, delete
on public.chats to authenticated;

grant select, insert
on public.messages to authenticated;

grant select, insert, update
on public.user_memory to authenticated;

grant usage, select
on sequence public.messages_id_seq to authenticated;
