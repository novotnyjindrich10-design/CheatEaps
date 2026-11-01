-- CheapEats: účet a přístup. Kódy slev v téhle databázi nejsou.
-- Drží je serverová funkce a vrátí je až po ověřené relaci.
-- V Supabase: SQL Editor → vložit → Run.
-- Doporučení: místo jednotlivých souborů spusť jednou supabase/bootstrap-all.sql.
-- Authentication → Providers → Email nech zapnutý.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Anonymní klíč nesmí profily číst. Žádná policy pro roli anon.
revoke all on table public.profiles from anon;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;
