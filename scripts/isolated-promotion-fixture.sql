-- Minimální fixture pro izolovaný Postgres (není produkce).
-- Emuluje role a auth.uid() dost na spuštění FoodGo promotion SQL.

create schema if not exists auth;
create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_cheapeats_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select profiles.is_admin from public.profiles where profiles.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_cheapeats_admin() from public;
grant execute on function public.is_cheapeats_admin() to authenticated;

-- Digest helper used by read_promotion_inquiry (Supabase: extensions.digest via search_path)
create or replace function public.digest(data bytea, type text)
returns bytea
language sql
immutable
as $$
  select extensions.digest(data, type);
$$;
