-- CheapEats: žádosti o přidání podniku, admin role a zveřejněné podniky.
-- Nejdřív spusť supabase/auth-rls.sql (public.profiles).
-- Doporučení: místo jednotlivých souborů spusť jednou supabase/bootstrap-all.sql
-- (zahrnuje i nastavení admina pro novotnyjindrich10@gmail.com, pokud profil existuje).
-- V Supabase: SQL Editor → vložit celý soubor → Run.
-- Soubor jde spustit znovu. Nemaže existující žádosti ani zveřejněné podniky.
-- Soukromé e-maily majitelů nejsou veřejně čitelné (RLS).
-- is_admin nastav jen ručně v SQL, nikdy z klientského JavaScriptu:
--   update public.profiles set is_admin = true where email = 'tvuj@email.cz';

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Nejdřív spusť supabase/auth-rls.sql';
  end if;
end $$;

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Klient nesmí sám sobě nastavit is_admin. Změnu dělej v SQL editoru (nebo jako už existující admin).
create or replace function public.protect_profiles_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
    if auth.uid() is not null
      and not coalesce(old.is_admin, false)
      and not exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
      ) then
      raise exception 'is_admin nelze měnit z klienta';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profiles_is_admin on public.profiles;
create trigger protect_profiles_is_admin
  before update on public.profiles
  for each row
  execute function public.protect_profiles_is_admin();

create or replace function public.is_cheapeats_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select profiles.is_admin from public.profiles where profiles.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_cheapeats_admin() from public;
grant execute on function public.is_cheapeats_admin() to authenticated;

create table if not exists public.business_applications (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  plan_id text not null default 'start',
  business_name text not null,
  address text not null,
  locality text not null default 'Brno',
  category text not null,
  category_label text not null default '',
  description text not null,
  owner_email text not null,
  website text not null default '',
  photo_mime text,
  photo_data text,
  proposed_place_id text not null,
  published_place_id text,
  admin_note text not null default '',
  email_status text not null default 'not_sent',
  email_error text not null default '',
  email_sent_at timestamptz,
  duplicate_of text not null default '',
  submitter_ip_hash text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  constraint business_applications_status_check
    check (status in ('pending', 'approved', 'rejected', 'needs_changes')),
  constraint business_applications_plan_check
    check (plan_id = 'start'),
  constraint business_applications_name_len
    check (char_length(btrim(business_name)) between 2 and 120),
  constraint business_applications_address_len
    check (char_length(btrim(address)) between 5 and 200),
  constraint business_applications_locality_len
    check (char_length(btrim(locality)) between 2 and 80),
  constraint business_applications_category_len
    check (char_length(btrim(category)) between 2 and 40),
  constraint business_applications_description_len
    check (char_length(btrim(description)) between 20 and 400),
  constraint business_applications_email_format
    check (owner_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(owner_email) <= 160),
  constraint business_applications_website_len
    check (char_length(website) <= 300),
  constraint business_applications_photo_mime_ok
    check (photo_mime is null or photo_mime in ('image/jpeg', 'image/png', 'image/webp')),
  constraint business_applications_photo_data_len
    check (photo_data is null or char_length(photo_data) <= 400000),
  constraint business_applications_place_id_format
    check (proposed_place_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint business_applications_email_status_check
    check (email_status in ('not_sent', 'sent', 'failed', 'skipped'))
);

create index if not exists business_applications_status_created_idx
  on public.business_applications (status, created_at desc);

create index if not exists business_applications_email_idx
  on public.business_applications (lower(owner_email));

create index if not exists business_applications_place_idx
  on public.business_applications (proposed_place_id);

create table if not exists public.published_places (
  id text primary key,
  application_id uuid not null unique references public.business_applications (id) on delete restrict,
  name text not null,
  description text not null,
  type text not null,
  category text not null,
  address text not null,
  website text not null default '',
  image_data_url text,
  source text not null default 'owner_application',
  is_new boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_places_id_format check (id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint published_places_name_len check (char_length(btrim(name)) between 2 and 120),
  constraint published_places_description_len check (char_length(btrim(description)) between 20 and 400),
  constraint published_places_address_len check (char_length(btrim(address)) between 5 and 200)
);

create index if not exists published_places_category_idx
  on public.published_places (category);

alter table public.business_applications enable row level security;
alter table public.published_places enable row level security;

revoke all on table public.business_applications from public, anon, authenticated;
grant insert on table public.business_applications to anon, authenticated;
grant select, update on table public.business_applications to authenticated;

revoke all on table public.published_places from public, anon, authenticated;
grant select on table public.published_places to anon, authenticated;
grant insert, update on table public.published_places to authenticated;

drop policy if exists "business_applications_insert_pending" on public.business_applications;
create policy "business_applications_insert_pending"
  on public.business_applications
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and plan_id = 'start'
    and email_status = 'not_sent'
    and coalesce(email_error, '') = ''
    and email_sent_at is null
    and published_place_id is null
    and reviewed_by is null
    and reviewed_at is null
    and coalesce(admin_note, '') = ''
  );

drop policy if exists "business_applications_admin_select" on public.business_applications;
create policy "business_applications_admin_select"
  on public.business_applications
  for select
  to authenticated
  using (public.is_cheapeats_admin());

drop policy if exists "business_applications_admin_update" on public.business_applications;
create policy "business_applications_admin_update"
  on public.business_applications
  for update
  to authenticated
  using (public.is_cheapeats_admin())
  with check (public.is_cheapeats_admin());

drop policy if exists "published_places_select_public" on public.published_places;
create policy "published_places_select_public"
  on public.published_places
  for select
  to anon, authenticated
  using (true);

drop policy if exists "published_places_admin_insert" on public.published_places;
create policy "published_places_admin_insert"
  on public.published_places
  for insert
  to authenticated
  with check (public.is_cheapeats_admin());

drop policy if exists "published_places_admin_update" on public.published_places;
create policy "published_places_admin_update"
  on public.published_places
  for update
  to authenticated
  using (public.is_cheapeats_admin())
  with check (public.is_cheapeats_admin());
