-- 课文小老师 MVP 最小云端存储
-- 在 Supabase SQL Editor 中执行本文件。
-- MVP 为了最快上线，只用一张表保存家庭空间完整 JSON。

create table if not exists public.spaces (
  code text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists spaces_touch_updated_at on public.spaces;
create trigger spaces_touch_updated_at
before update on public.spaces
for each row
execute function public.touch_updated_at();

alter table public.spaces enable row level security;

-- MVP 暂不做登录，依靠随机家庭空间码/分享链接隔离。
-- 注意：这是早期内测方案，不适合存放敏感个人信息。
drop policy if exists "spaces_select_anon" on public.spaces;
create policy "spaces_select_anon"
on public.spaces
for select
to anon
using (true);

drop policy if exists "spaces_insert_anon" on public.spaces;
create policy "spaces_insert_anon"
on public.spaces
for insert
to anon
with check (true);

drop policy if exists "spaces_update_anon" on public.spaces;
create policy "spaces_update_anon"
on public.spaces
for update
to anon
using (true)
with check (true);
