-- CheapEats: jednorázový bezpečný bootstrap databáze (idempotentní).
-- Spusť CELÝ soubor v Supabase → SQL Editor → Run.
-- Pořadí: auth/profiles → community → business → admin z auth.users.
-- Nemaže tabulky ani uživatelská data. Lze spustit znovu.
-- Service role / Dashboard SQL běží mimo RLS klientských policy.
--
-- Bezpečnost profilů:
-- - Klient smí měnit jen display_name (column GRANT + trigger).
-- - email a is_admin klient nemění; admin se nastavuje jen z auth.users.

-- =============================================================================
-- 1) AUTH / PROFILES
-- =============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists display_name text;

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

alter table public.profiles drop constraint if exists profiles_display_name_public;
alter table public.profiles
  add constraint profiles_display_name_public
  check (
    display_name is null
    or (
      char_length(btrim(display_name)) between 2 and 32
      and position('@' in display_name) = 0
    )
  );

alter table public.profiles enable row level security;

-- Klient: čtení vlastního profilu, insert vlastního řádku, update jen display_name.
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant insert (id, email, display_name) on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (
    auth.uid() = id
    and coalesce(is_admin, false) = false
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
-- Změnu email / is_admin / id blokuje grant jen na display_name + trigger protect_profiles_row.

-- Z auth.users drží e-mail a blokuje změnu id / email / is_admin / created_at z klienta.
create or replace function public.protect_profiles_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  auth_email text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.id := auth.uid();
      new.is_admin := false;
      select users.email into auth_email from auth.users as users where users.id = auth.uid();
      new.email := auth_email;
    end if;
    return new;
  end if;

  -- UPDATE
  if auth.uid() is not null then
    new.id := old.id;
    new.created_at := old.created_at;
    new.is_admin := old.is_admin;
    select users.email into auth_email from auth.users as users where users.id = old.id;
    new.email := coalesce(auth_email, old.email);
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profiles_is_admin on public.profiles;
drop trigger if exists protect_profiles_row on public.profiles;
create trigger protect_profiles_row
  before insert or update on public.profiles
  for each row
  execute function public.protect_profiles_row();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (new.id, new.email, false)
  on conflict (id) do update
    set email = excluded.email;
  -- is_admin při konfliktu neměníme (nesmí se resetovat při změně e-mailu v Auth).
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.protect_profiles_row() from public, anon, authenticated;

-- Zrcadlení e-mailu z důvěryhodného auth.users (ne z klientského vstupu).
insert into public.profiles (id, email, is_admin)
select users.id, users.email, false
from auth.users as users
where not exists (
  select 1 from public.profiles as profiles where profiles.id = users.id
)
on conflict (id) do nothing;

update public.profiles as profiles
set email = users.email
from auth.users as users
where profiles.id = users.id
  and profiles.email is distinct from users.email;

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

-- =============================================================================
-- 2) COMMUNITY (favorites / reviews / reports)
-- =============================================================================

create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, restaurant_id),
  constraint favorites_restaurant_id_format check (restaurant_id ~ '^[a-z0-9][a-z0-9-]{0,79}$')
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id text not null,
  rating smallint not null,
  body text not null,
  author_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_one_per_user unique (user_id, restaurant_id),
  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_body_length check (char_length(body) between 1 and 1000),
  constraint reviews_author_label_length check (char_length(author_label) between 1 and 40),
  constraint reviews_restaurant_id_format check (restaurant_id ~ '^[a-z0-9][a-z0-9-]{0,79}$')
);

create index if not exists reviews_restaurant_created_idx
  on public.reviews (restaurant_id, created_at desc);

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint review_reports_once unique (review_id, reporter_id),
  constraint review_reports_reason_length check (char_length(reason) between 1 and 280)
);

create index if not exists review_reports_review_idx
  on public.review_reports (review_id);

alter table public.favorites enable row level security;
alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;

revoke all on table public.favorites from public, anon;
grant select, insert, delete on table public.favorites to authenticated;

revoke all on table public.reviews from public, anon;
grant select on table public.reviews to anon, authenticated;
grant insert, update, delete on table public.reviews to authenticated;

revoke all on table public.review_reports from public, anon;
grant select, insert on table public.review_reports to authenticated;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
  on public.favorites for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
  on public.favorites for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
  on public.favorites for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reviews_select_public" on public.reviews;
create policy "reviews_select_public"
  on public.reviews for select to anon, authenticated
  using (true);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
  on public.reviews for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own"
  on public.reviews for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own"
  on public.reviews for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "review_reports_select_own" on public.review_reports;
create policy "review_reports_select_own"
  on public.review_reports for select to authenticated
  using (auth.uid() = reporter_id);

drop policy if exists "review_reports_insert_own" on public.review_reports;
create policy "review_reports_insert_own"
  on public.review_reports for insert to authenticated
  with check (
    auth.uid() = reporter_id
    and not exists (
      select 1
      from public.reviews as reviews
      where reviews.id = review_id
        and reviews.user_id = auth.uid()
    )
  );

create or replace function public.protect_favorite()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists favorites_protect on public.favorites;
create trigger favorites_protect
  before insert on public.favorites
  for each row execute function public.protect_favorite();

create or replace function public.review_author_label(account uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  label text;
begin
  select btrim(display_name)
  into label
  from public.profiles
  where id = account;

  if label is null
    or char_length(label) < 2
    or char_length(label) > 32
    or position('@' in label) > 0
  then
    return 'Host ' || left(replace(account::text, '-', ''), 6);
  end if;

  return label;
end;
$$;

create or replace function public.protect_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.restaurant_id := old.restaurant_id;
    new.created_at := old.created_at;
  else
    new.user_id := auth.uid();
  end if;
  if new.user_id is distinct from auth.uid() then
    raise exception 'review owner mismatch';
  end if;
  new.author_label := public.review_author_label(auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reviews_protect on public.reviews;
create trigger reviews_protect
  before insert or update on public.reviews
  for each row execute function public.protect_review();

create or replace function public.protect_review_report()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  new.reporter_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists review_reports_protect on public.review_reports;
create trigger review_reports_protect
  before insert on public.review_reports
  for each row execute function public.protect_review_report();

revoke all on function public.protect_favorite() from public, anon, authenticated;
revoke all on function public.protect_review() from public, anon, authenticated;
revoke all on function public.protect_review_report() from public, anon, authenticated;
revoke all on function public.review_author_label(uuid) from public, anon, authenticated;

-- =============================================================================
-- 3) BUSINESS APPLICATIONS + PUBLISHED PLACES
-- =============================================================================

create table if not exists public.business_applications (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  plan_id text not null default 'start',
  business_name text not null,
  address text not null,
  locality text not null default 'Brno',
  category text not null,
  category_label text not null default '',
  cuisine_focus text not null default '',
  description text not null,
  description_original text not null default '',
  description_review_engine text not null default '',
  description_review_notes text not null default '',
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
  existence_status text not null default 'unavailable',
  existence_summary text not null default '',
  existence_requires_manual boolean not null default true,
  existence_candidates jsonb not null default '[]'::jsonb,
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
  constraint business_applications_cuisine_focus_len
    check (char_length(cuisine_focus) <= 80),
  constraint business_applications_description_len
    check (char_length(btrim(description)) between 20 and 400),
  constraint business_applications_description_original_len
    check (char_length(description_original) <= 400),
  constraint business_applications_email_format
    check (owner_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and char_length(owner_email) <= 160),
  constraint business_applications_website_len
    check (char_length(website) <= 300),
  constraint business_applications_photo_mime_ok
    check (photo_mime is null or photo_mime in ('image/jpeg', 'image/png', 'image/webp')),
  constraint business_applications_photo_data_len
    check (photo_data is null or char_length(photo_data) <= 400000),
  constraint business_applications_place_id_format
    check (proposed_place_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint business_applications_email_status_check
    check (email_status in ('not_sent', 'sent', 'failed', 'skipped')),
  constraint business_applications_existence_status_check
    check (existence_status in ('unavailable', 'likely_match', 'ambiguous', 'no_match'))
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
    and existence_requires_manual = true
    and existence_status in ('unavailable', 'likely_match', 'ambiguous', 'no_match')
    and description_review_engine in ('', 'rules')
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

-- =============================================================================
-- 4) ADMIN z auth.users (ne z upravitelného profiles.email)
-- =============================================================================

do $$
declare
  updated_count integer;
  target_id uuid;
begin
  select users.id
  into target_id
  from auth.users as users
  where lower(users.email) = lower('novotnyjindrich10@gmail.com')
  limit 1;

  if target_id is null then
    raise notice 'Admin nebyl nastaven: účet novotnyjindrich10@gmail.com v auth.users neexistuje. Nejdřív registrace, pak spusť bootstrap znovu.';
  else
    insert into public.profiles (id, email, is_admin)
    select users.id, users.email, true
    from auth.users as users
    where users.id = target_id
    on conflict (id) do update
      set email = excluded.email,
          is_admin = true;

    get diagnostics updated_count = row_count;
    raise notice 'Admin nastaven podle auth.users pro novotnyjindrich10@gmail.com (id %, řádků %).', target_id, updated_count;
  end if;
end $$;

-- Ověření po běhu (Results):
select
  to_regclass('public.profiles') as profiles,
  to_regclass('public.favorites') as favorites,
  to_regclass('public.reviews') as reviews,
  to_regclass('public.business_applications') as business_applications,
  to_regclass('public.published_places') as published_places;

select
  profiles.id,
  users.email as auth_email,
  profiles.email as profile_email,
  profiles.is_admin
from public.profiles as profiles
join auth.users as users on users.id = profiles.id
where lower(users.email) = lower('novotnyjindrich10@gmail.com');
