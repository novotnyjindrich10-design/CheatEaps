-- =============================================================================
-- FoodGo Preview bootstrap — JEDEN soubor pro prázdný projekt foodgo-preview
-- Cíl: jnyxjyyvzxriuyvyiuxe  (https://jnyxjyyvzxriuyvyiuxe.supabase.co)
-- ZAKÁZÁNO: pcptzyfoojmnspumcmsi (produkce)
--
-- Spuštění: Supabase Dashboard → projekt foodgo-preview → SQL Editor → Run
-- (celý soubor najednou). Idempotentní. Bez produkčních uživatelů a hesel.
-- Generováno: node scripts/build-preview-bootstrap-sql.mjs
-- Pořadí částí: supabase/bootstrap-all.sql → supabase/business-applications-form-v2.sql → supabase/loyalty.sql → supabase/promotion-apply-missing.sql → supabase/place-reports.sql → supabase/place-overrides.sql → supabase/place-stats.sql → supabase/preview-synthetic-seed.sql
-- =============================================================================

do $$
begin
  -- SQL Editor nezná project ref; kontrola je organizační.
  -- Pokud jsi v produkčním projektu pcptzyfoojmnspumcmsi, ZASTAV a spusť to jen na foodgo-preview.
  raise notice 'FoodGo preview bootstrap: ověř, že jsi v projektu jnyxjyyvzxriuyvyiuxe, ne pcptzyfoojmnspumcmsi';
end $$;


-- #############################################################################
-- BEGIN supabase/bootstrap-all.sql
-- #############################################################################

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

-- #############################################################################
-- END supabase/bootstrap-all.sql
-- #############################################################################


-- #############################################################################
-- BEGIN supabase/business-applications-form-v2.sql
-- #############################################################################

-- CheapEats: rozšíření žádostí o podnik pro formulář (ne chatbot).
-- Spusť v SQL Editoru PO úspěšném supabase/bootstrap-all.sql (nebo starším business-applications.sql).
-- Idempotentní. Nemaže žádosti ani published_places.
-- Nevzdáleně nespouštět z agenta — jen ručně v Dashboardu.
--
-- Tato migrace:
-- 1) přidá sloupce používané frontendem/API,
-- 2) znovu potvrdí RLS/GRANT (nezvyšuje práva anon),
-- 3) zpřísní INSERT tak, aby veřejný insert nemohl nastavit schválení,
--    admin_note, e-mailové stavy ani vypnout ruční kontrolu.

do $$
begin
  if to_regclass('public.business_applications') is null then
    raise exception 'Nejdřív spusť supabase/bootstrap-all.sql (chybí public.business_applications).';
  end if;
end $$;

alter table public.business_applications
  add column if not exists cuisine_focus text not null default '';

alter table public.business_applications
  add column if not exists description_original text not null default '';

alter table public.business_applications
  add column if not exists description_review_engine text not null default '';

alter table public.business_applications
  add column if not exists description_review_notes text not null default '';

alter table public.business_applications
  add column if not exists existence_status text not null default 'unavailable';

alter table public.business_applications
  add column if not exists existence_summary text not null default '';

alter table public.business_applications
  add column if not exists existence_requires_manual boolean not null default true;

alter table public.business_applications
  add column if not exists existence_candidates jsonb not null default '[]'::jsonb;

alter table public.business_applications drop constraint if exists business_applications_existence_status_check;
alter table public.business_applications
  add constraint business_applications_existence_status_check
  check (existence_status in ('unavailable', 'likely_match', 'ambiguous', 'no_match'));

alter table public.business_applications drop constraint if exists business_applications_cuisine_focus_len;
alter table public.business_applications
  add constraint business_applications_cuisine_focus_len
  check (char_length(cuisine_focus) <= 80);

alter table public.business_applications drop constraint if exists business_applications_description_original_len;
alter table public.business_applications
  add constraint business_applications_description_original_len
  check (char_length(description_original) <= 400);

alter table public.business_applications drop constraint if exists business_applications_description_review_engine_len;
alter table public.business_applications
  add constraint business_applications_description_review_engine_len
  check (char_length(description_review_engine) <= 40);

alter table public.business_applications drop constraint if exists business_applications_description_review_notes_len;
alter table public.business_applications
  add constraint business_applications_description_review_notes_len
  check (char_length(description_review_notes) <= 1000);

alter table public.business_applications drop constraint if exists business_applications_existence_summary_len;
alter table public.business_applications
  add constraint business_applications_existence_summary_len
  check (char_length(existence_summary) <= 600);

-- Existující řádky: doplň originál popisu, pokud chybí. Nemění finální description.
update public.business_applications
set description_original = description
where btrim(coalesce(description_original, '')) = ''
  and btrim(coalesce(description, '')) <> '';

-- Zachovej RLS zapnuté a práva bez eskalace.
alter table public.business_applications enable row level security;
alter table public.published_places enable row level security;

revoke all on table public.business_applications from public, anon, authenticated;
grant insert on table public.business_applications to anon, authenticated;
grant select, update on table public.business_applications to authenticated;

revoke all on table public.published_places from public, anon, authenticated;
grant select on table public.published_places to anon, authenticated;
grant insert, update on table public.published_places to authenticated;

-- Veřejný INSERT: jen pending žádost. Nesmí schválit, publikovat, vypnout ruční kontrolu
-- ani předstírat odeslaný e-mail / admin poznámku.
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

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'business_applications'
  and column_name in (
    'cuisine_focus',
    'description_original',
    'description_review_engine',
    'description_review_notes',
    'existence_status',
    'existence_summary',
    'existence_requires_manual',
    'existence_candidates'
  )
order by column_name;

-- #############################################################################
-- END supabase/business-applications-form-v2.sql
-- #############################################################################


-- #############################################################################
-- BEGIN supabase/loyalty.sql
-- #############################################################################

-- CheapEats: věrnostní body, odměny a slevové kódy.
-- Předpoklady: auth-rls/bootstrap (profiles), community (reviews), business/bootstrap (profiles.is_admin).
-- Spusť v Supabase SQL Editoru ručně. Soubor je idempotentní.
-- Nespouští se automaticky z aplikace.
-- Po tomto souboru znovu nespouštěj starší community.sql bez aktualizované protect_review
-- (tenhle skript protect_review nahrazuje bezpečnější verzí).

-- ---------------------------------------------------------------------------
-- 0) Předpoklady — při chybě skončí celá migrace (žádná částečná instalace).
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'loyalty.sql: chybí public.profiles. Nejdřív spusť auth-rls.sql nebo bootstrap-all.sql.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_admin'
  ) then
    raise exception 'loyalty.sql: chybí profiles.is_admin. Nejdřív spusť business-applications.sql nebo bootstrap-all.sql.';
  end if;

  if to_regclass('public.reviews') is null then
    raise exception 'loyalty.sql: chybí public.reviews. Nejdřív spusť community.sql nebo bootstrap-all.sql.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) Moderace recenzí
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists moderation_status text not null default 'pending';

alter table public.reviews drop constraint if exists reviews_moderation_status_check;
alter table public.reviews
  add constraint reviews_moderation_status_check
  check (moderation_status in ('pending', 'approved', 'rejected'));

alter table public.reviews
  add column if not exists moderated_at timestamptz;

alter table public.reviews
  add column if not exists moderated_by uuid references auth.users (id) on delete set null;

-- Existující recenze zůstávají pending díky DEFAULT sloupce.
-- Nic se hromadně neschvaluje a za staré recenze se nepřipisují body.
-- Schválení je jen ruční, přes loyalty_award_review_points, a to jen pro is_admin.
-- Skript recenze nemaže.
create table if not exists public.schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

insert into public.schema_migrations (id)
values ('loyalty_v1_reviews_remain_pending')
on conflict (id) do nothing;

create index if not exists reviews_moderation_status_idx
  on public.reviews (moderation_status, created_at desc);

-- Klient (role authenticated/anon) nesmí měnit moderaci; RPC běží jako definer (postgres) a smí.
create or replace function public.protect_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Přímé REST / klientské zápisy
  if current_user in ('authenticated', 'anon') then
    if auth.uid() is null then
      raise exception 'not authenticated';
    end if;

    if tg_op = 'UPDATE' then
      new.user_id := old.user_id;
      new.restaurant_id := old.restaurant_id;
      new.created_at := old.created_at;
      -- Moderaci smí měnit jen SECURITY DEFINER RPC (jiná DB role než authenticated).
      new.moderation_status := old.moderation_status;
      new.moderated_at := old.moderated_at;
      new.moderated_by := old.moderated_by;
    else
      new.user_id := auth.uid();
      new.moderation_status := 'pending';
      new.moderated_at := null;
      new.moderated_by := null;
    end if;

    if new.user_id is distinct from auth.uid() then
      raise exception 'review owner mismatch';
    end if;

    new.author_label := public.review_author_label(auth.uid());
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_protect on public.reviews;
create trigger reviews_protect
  before insert or update on public.reviews
  for each row execute function public.protect_review();

revoke all on function public.protect_review() from public, anon, authenticated;

drop policy if exists "reviews_select_public" on public.reviews;
create policy "reviews_select_public"
  on public.reviews
  for select
  to anon, authenticated
  using (
    moderation_status = 'approved'
    or (auth.uid() is not null and auth.uid() = user_id)
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin is true
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Body na profilu — sloupcová práva + trigger
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists loyalty_points integer not null default 0;

alter table public.profiles drop constraint if exists profiles_loyalty_points_nonneg;
alter table public.profiles
  add constraint profiles_loyalty_points_nonneg check (loyalty_points >= 0);

-- Sloupcová práva: klient nesmí updatovat loyalty_points (ani is_admin / email).
revoke update on table public.profiles from authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant select on table public.profiles to authenticated;

-- INSERT zůstává omezený (bez is_admin / loyalty_points z klienta).
revoke insert on table public.profiles from authenticated;
grant insert (id, email, display_name) on table public.profiles to authenticated;

create or replace function public.protect_profiles_loyalty_points()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Jen přímé klientské zápisy; RPC definer (postgres) smí měnit body.
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.loyalty_points := 0;
    elsif tg_op = 'UPDATE' then
      new.loyalty_points := old.loyalty_points;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profiles_loyalty_points on public.profiles;
create trigger protect_profiles_loyalty_points
  before insert or update on public.profiles
  for each row execute function public.protect_profiles_loyalty_points();

revoke all on function public.protect_profiles_loyalty_points() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Tabulky věrnosti
-- ---------------------------------------------------------------------------
create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null,
  kind text not null,
  reference_type text,
  reference_id text,
  note text,
  balance_after integer not null,
  created_at timestamptz not null default now(),
  constraint loyalty_transactions_kind_check
    check (kind in ('review_reward', 'redemption', 'adjustment')),
  constraint loyalty_transactions_amount_nonzero check (amount <> 0),
  constraint loyalty_transactions_balance_nonneg check (balance_after >= 0)
);

create unique index if not exists loyalty_transactions_review_reward_once
  on public.loyalty_transactions (user_id, reference_id)
  where kind = 'review_reward' and reference_type = 'review';

create index if not exists loyalty_transactions_user_created_idx
  on public.loyalty_transactions (user_id, created_at desc);

create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  partner_name text not null default '',
  points_cost integer not null,
  status text not null default 'coming_soon',
  terms text not null default '',
  valid_until timestamptz,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_rewards_points_positive check (points_cost > 0),
  constraint loyalty_rewards_status_check
    check (status in ('coming_soon', 'available', 'disabled')),
  constraint loyalty_rewards_title_length check (char_length(title) between 2 and 120),
  constraint loyalty_rewards_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);

create table if not exists public.loyalty_reward_codes (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.loyalty_rewards (id) on delete cascade,
  code text not null,
  status text not null default 'available',
  redeemed_by uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz,
  redemption_id uuid,
  created_at timestamptz not null default now(),
  constraint loyalty_reward_codes_status_check
    check (status in ('available', 'redeemed')),
  constraint loyalty_reward_codes_code_length check (char_length(code) between 4 and 64),
  constraint loyalty_reward_codes_unique_code unique (reward_id, code)
);

create index if not exists loyalty_reward_codes_available_idx
  on public.loyalty_reward_codes (reward_id, status)
  where status = 'available';

create table if not exists public.loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reward_id uuid not null references public.loyalty_rewards (id) on delete restrict,
  code_id uuid not null references public.loyalty_reward_codes (id) on delete restrict,
  points_spent integer not null,
  code_snapshot text not null,
  created_at timestamptz not null default now(),
  constraint loyalty_redemptions_points_positive check (points_spent > 0),
  constraint loyalty_redemptions_code_unique unique (code_id)
);

create index if not exists loyalty_redemptions_user_created_idx
  on public.loyalty_redemptions (user_id, created_at desc);

alter table public.loyalty_reward_codes
  drop constraint if exists loyalty_reward_codes_redemption_fk;
alter table public.loyalty_reward_codes
  add constraint loyalty_reward_codes_redemption_fk
  foreign key (redemption_id) references public.loyalty_redemptions (id) on delete set null;

alter table public.loyalty_transactions enable row level security;
alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_reward_codes enable row level security;
alter table public.loyalty_redemptions enable row level security;

revoke all on table public.loyalty_transactions from public, anon, authenticated;
revoke all on table public.loyalty_rewards from public, anon, authenticated;
revoke all on table public.loyalty_reward_codes from public, anon, authenticated;
revoke all on table public.loyalty_redemptions from public, anon, authenticated;

-- Transakce a uplatnění: jen čtení vlastních (zápis výhradně přes SECURITY DEFINER RPC).
grant select on table public.loyalty_transactions to authenticated;
grant select on table public.loyalty_redemptions to authenticated;

-- Katalog odměn: veřejné čtení; zápis jen authenticated + admin RLS.
grant select on table public.loyalty_rewards to anon, authenticated;
grant insert, update on table public.loyalty_rewards to authenticated;

-- Kódy: žádné veřejné čtení; admin SELECT/INSERT přes RLS (běžný user neuvidí cizí kódy).
grant select, insert on table public.loyalty_reward_codes to authenticated;

drop policy if exists "loyalty_tx_select_own" on public.loyalty_transactions;
create policy "loyalty_tx_select_own"
  on public.loyalty_transactions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "loyalty_rewards_select_public" on public.loyalty_rewards;
create policy "loyalty_rewards_select_public"
  on public.loyalty_rewards for select to anon, authenticated
  using (
    status in ('coming_soon', 'available')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin is true)
  );

drop policy if exists "loyalty_redemptions_select_own" on public.loyalty_redemptions;
create policy "loyalty_redemptions_select_own"
  on public.loyalty_redemptions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "loyalty_rewards_admin_write" on public.loyalty_rewards;
create policy "loyalty_rewards_admin_write"
  on public.loyalty_rewards for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin is true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin is true));

drop policy if exists "loyalty_codes_admin_select" on public.loyalty_reward_codes;
create policy "loyalty_codes_admin_select"
  on public.loyalty_reward_codes for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin is true));

drop policy if exists "loyalty_codes_admin_insert" on public.loyalty_reward_codes;
create policy "loyalty_codes_admin_insert"
  on public.loyalty_reward_codes for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin is true));

-- Žádné INSERT/UPDATE/DELETE policies na loyalty_transactions / loyalty_redemptions pro klienty.

-- ---------------------------------------------------------------------------
-- 4) SECURITY DEFINER RPC (search_path uzamčený)
-- ---------------------------------------------------------------------------
create or replace function public.loyalty_award_review_points(p_review_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_review public.reviews%rowtype;
  v_admin boolean;
  v_points integer := 5;
  v_balance integer;
  v_tx_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'auth-required');
  end if;

  select coalesce(is_admin, false) into v_admin from public.profiles where id = auth.uid();
  if not coalesce(v_admin, false) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_review from public.reviews where id = p_review_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'review-missing');
  end if;

  if v_review.moderation_status = 'approved' then
    null;
  elsif v_review.moderation_status = 'rejected' then
    return jsonb_build_object('ok', false, 'error', 'review-rejected');
  else
    update public.reviews
    set moderation_status = 'approved',
        moderated_at = now(),
        moderated_by = auth.uid(),
        updated_at = now()
    where id = p_review_id;
  end if;

  if exists (
    select 1 from public.loyalty_transactions
    where user_id = v_review.user_id
      and kind = 'review_reward'
      and reference_type = 'review'
      and reference_id = p_review_id::text
  ) then
    select loyalty_points into v_balance from public.profiles where id = v_review.user_id;
    return jsonb_build_object(
      'ok', true,
      'awarded', false,
      'already', true,
      'points', coalesce(v_balance, 0),
      'reviewId', p_review_id
    );
  end if;

  update public.profiles
  set loyalty_points = loyalty_points + v_points
  where id = v_review.user_id
  returning loyalty_points into v_balance;

  if v_balance is null then
    insert into public.profiles (id, email, loyalty_points)
    values (v_review.user_id, '', v_points)
    on conflict (id) do update set loyalty_points = public.profiles.loyalty_points + v_points
    returning loyalty_points into v_balance;
  end if;

  insert into public.loyalty_transactions (
    user_id, amount, kind, reference_type, reference_id, note, balance_after
  ) values (
    v_review.user_id, v_points, 'review_reward', 'review', p_review_id::text,
    'Body za schválenou recenzi', v_balance
  )
  returning id into v_tx_id;

  return jsonb_build_object(
    'ok', true,
    'awarded', true,
    'points', v_balance,
    'amount', v_points,
    'transactionId', v_tx_id,
    'reviewId', p_review_id
  );
exception
  when unique_violation then
    select loyalty_points into v_balance from public.profiles where id = v_review.user_id;
    return jsonb_build_object('ok', true, 'awarded', false, 'already', true, 'points', coalesce(v_balance, 0));
end;
$$;

create or replace function public.loyalty_reject_review(p_review_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'auth-required');
  end if;
  select coalesce(is_admin, false) into v_admin from public.profiles where id = auth.uid();
  if not coalesce(v_admin, false) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  update public.reviews
  set moderation_status = 'rejected',
      moderated_at = now(),
      moderated_by = auth.uid(),
      updated_at = now()
  where id = p_review_id and moderation_status = 'pending';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'review-missing-or-not-pending');
  end if;
  return jsonb_build_object('ok', true, 'rejected', true, 'reviewId', p_review_id);
end;
$$;

create or replace function public.loyalty_redeem_reward(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_reward public.loyalty_rewards%rowtype;
  v_code public.loyalty_reward_codes%rowtype;
  v_balance integer;
  v_redemption_id uuid;
  v_tx_id uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'auth-required');
  end if;

  select * into v_reward from public.loyalty_rewards where id = p_reward_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'reward-missing');
  end if;
  if v_reward.status = 'coming_soon' then
    return jsonb_build_object('ok', false, 'error', 'coming-soon');
  end if;
  if v_reward.status <> 'available' then
    return jsonb_build_object('ok', false, 'error', 'reward-unavailable');
  end if;
  if v_reward.valid_until is not null and v_reward.valid_until < now() then
    return jsonb_build_object('ok', false, 'error', 'reward-expired');
  end if;

  select * into v_code
  from public.loyalty_reward_codes
  where reward_id = p_reward_id and status = 'available'
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'code-unavailable');
  end if;

  select loyalty_points into v_balance from public.profiles where id = v_user for update;
  if v_balance is null then
    v_balance := 0;
  end if;
  if v_balance < v_reward.points_cost then
    return jsonb_build_object(
      'ok', false,
      'error', 'insufficient-points',
      'points', v_balance,
      'needed', v_reward.points_cost
    );
  end if;

  v_balance := v_balance - v_reward.points_cost;
  update public.profiles set loyalty_points = v_balance where id = v_user;

  insert into public.loyalty_redemptions (
    user_id, reward_id, code_id, points_spent, code_snapshot
  ) values (
    v_user, p_reward_id, v_code.id, v_reward.points_cost, v_code.code
  )
  returning id into v_redemption_id;

  update public.loyalty_reward_codes
  set status = 'redeemed',
      redeemed_by = v_user,
      redeemed_at = now(),
      redemption_id = v_redemption_id
  where id = v_code.id and status = 'available';

  if not found then
    raise exception 'code-race';
  end if;

  insert into public.loyalty_transactions (
    user_id, amount, kind, reference_type, reference_id, note, balance_after
  ) values (
    v_user, -v_reward.points_cost, 'redemption', 'reward', p_reward_id::text,
    'Uplatnění odměny: ' || v_reward.title, v_balance
  )
  returning id into v_tx_id;

  return jsonb_build_object(
    'ok', true,
    'redemptionId', v_redemption_id,
    'rewardId', p_reward_id,
    'code', v_code.code,
    'pointsSpent', v_reward.points_cost,
    'points', v_balance,
    'transactionId', v_tx_id
  );
exception
  when others then
    if SQLERRM = 'code-race' then
      return jsonb_build_object('ok', false, 'error', 'code-unavailable');
    end if;
    raise;
end;
$$;

revoke all on function public.loyalty_award_review_points(uuid) from public, anon;
revoke all on function public.loyalty_reject_review(uuid) from public, anon;
revoke all on function public.loyalty_redeem_reward(uuid) from public, anon;
grant execute on function public.loyalty_award_review_points(uuid) to authenticated;
grant execute on function public.loyalty_reject_review(uuid) to authenticated;
grant execute on function public.loyalty_redeem_reward(uuid) to authenticated;

-- Žádná ukázková ani partnerská odměna. Řádek v loyalty_rewards zakládá jen
-- administrátor a stav available dává až po vložení skutečných slevových kódů.
-- Bez kódu veřejné API odměnu neoznačí za uplatnitelnou a redeem body neodečte.
-- Tento skript do loyalty_rewards nic nevkládá.

-- #############################################################################
-- END supabase/loyalty.sql
-- #############################################################################


-- #############################################################################
-- BEGIN supabase/promotion-apply-missing.sql
-- #############################################################################

-- =============================================================================
-- FoodGo: jednorázová doplňující migrace propagace (RPC + owners)
-- =============================================================================
-- ÚČEL (stav ověřený proti pcptzyfoojmnspumcmsi, 2026-11-24):
--   • promotion_orders / promotion_payment_events / promotion_sponsorships_public
--     UŽ EXISTUJÍ
--   • CHYBÍ RPC: submit_promotion_inquiry, read_promotion_inquiry,
--     record_verified_payment (+ trigger guard_promotion_order)
--   • CHYBÍ: place_owner_claims, promotion_audit_log
--
-- NESPUSŤ bez výslovného schválení. Spouští se v Supabase → SQL Editor → Run.
-- Nemění a nemaže: auth.users, profiles, reviews, favorites, business_applications,
-- published_places ani existující řádky promotion_orders.
-- Žádné DROP TABLE / TRUNCATE / DELETE.
--
-- PŘEDPOKLADY: bootstrap-all (nebo auth-rls + business-applications) už běží —
-- public.profiles, profiles.is_admin, public.is_cheapeats_admin().
--
-- ZÁLOHA (před spuštěním, Dashboard / CLI):
--   1) Supabase → Database → Backups (nebo Point-in-time) — ověř dostupný restore
--   2) Volitelně data-only dump jen objednávek:
--        select * from public.promotion_orders;
--        select * from public.promotion_payment_events;
--
-- ROLLBACK — bezpečné (nesmaže uživatelská data v objednávkách):
--   drop trigger if exists guard_promotion_order on public.promotion_orders;
--   drop function if exists public.guard_promotion_order();
--   drop function if exists public.submit_promotion_inquiry(jsonb, text, text);
--   drop function if exists public.read_promotion_inquiry(text, text);
--   drop function if exists public.record_verified_payment(text, text, text, text);
--   -- promotion_orders / promotion_payment_events / view / řádky poptávek NEMĚŇ a NEDROPUJ
--
-- ROLLBACK owners tabulek (POZOR — smaže žádosti o vlastnictví a audit vzniklé PO migraci):
--   Pouze pokud jsou tabulky prázdné, nebo po výslovném schválení ztráty těchto dat:
--     select count(*) from public.place_owner_claims;
--     select count(*) from public.promotion_audit_log;
--     drop table if exists public.promotion_audit_log;
--     drop table if exists public.place_owner_claims;
--   Nikdy nedropuj public.promotion_orders kvůli rollbacku doplňku.
--
-- PO MIGRACI:
--   Vercel: SUPABASE_SERVICE_ROLE_KEY = sb_secret_… (jen server, nikdy VITE_*).
--   Comgate secret NEukládej do databáze. Server ho ověří dřív, než zavolá RPC.
--   psql: psql --single-transaction -f supabase/promotion-apply-missing.sql
--   Supabase SQL Editor: jeden Run je jedna transakce. Chyba vrátí celý běh.
-- =============================================================================

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'chybí public.profiles — nejdřív supabase/bootstrap-all.sql';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_admin'
  ) then
    raise exception 'chybí profiles.is_admin — nejdřív bootstrap / business-applications';
  end if;
  if to_regprocedure('public.is_cheapeats_admin()') is null then
    raise exception 'chybí public.is_cheapeats_admin()';
  end if;
end $$;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1) Tabulky objednávek (idempotentní — už existují, jen doplní chybějící sloupce)
-- ---------------------------------------------------------------------------

create table if not exists public.promotion_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  access_hash text not null,
  status text not null default 'inquiry',
  payment_status text not null default 'none',
  payment_source text not null default '',
  plan_id text not null,
  plan_name text not null default '',
  period_id text not null,
  amount integer not null,
  currency text not null default 'CZK',
  service_days integer not null,
  service_label text not null default '',
  renewal text not null default 'none',
  vat_status text not null default 'unconfirmed',
  vat_note text not null default '',
  place_id text not null default '',
  place_key text not null,
  business_name text not null,
  company_name text not null,
  ico text not null default '',
  dic text not null default '',
  contact_name text not null,
  email text not null,
  phone text not null,
  billing_address text not null,
  website text not null default '',
  description text not null default '',
  note text not null default '',
  admin_note text not null default '',
  invoice_number text not null default '',
  invoice_issued_at timestamptz,
  invoice_note text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  activated_at timestamptz
);

alter table public.promotion_orders add column if not exists invoice_number text not null default '';
alter table public.promotion_orders add column if not exists invoice_issued_at timestamptz;
alter table public.promotion_orders add column if not exists invoice_note text not null default '';
alter table public.promotion_orders add column if not exists payment_source text not null default '';
alter table public.promotion_orders add column if not exists admin_note text not null default '';

create table if not exists public.promotion_payment_events (
  event_id text primary key,
  reference text not null,
  status text not null,
  received_at timestamptz not null default now()
);

-- Před novými omezeními: když existující řádky nesedí, migrace spadne a nic nesmaže.
do $$
declare
  bad integer;
begin
  select count(*) into bad
  from public.promotion_orders
  where status not in ('inquiry', 'accepted', 'active', 'declined', 'ended')
     or payment_status not in ('none', 'invoiced', 'paid', 'failed')
     or plan_id not in ('start', 'plus', 'premium')
     or period_id not in ('mesicne', 'rocne')
     or renewal is distinct from 'none'
     or amount <= 0
     or service_days not in (30, 365)
     or vat_status not in ('unconfirmed', 'non-payer', 'payer')
     or char_length(coalesce(invoice_number, '')) > 40;
  if bad > 0 then
    raise exception 'promotion-apply-missing: % existujících řádků porušuje nová omezení. Migrace se nespustila, data zůstávají.', bad;
  end if;

  select count(*) into bad
  from (
    select 1
    from public.promotion_orders
    where status in ('inquiry', 'accepted', 'active')
    group by lower(email), plan_id, period_id, place_key
    having count(*) > 1
  ) duplicates;
  if bad > 0 then
    raise exception 'promotion-apply-missing: % skupin otevřených poptávek by porušilo unique index. Migrace se nespustila.', bad;
  end if;
end $$;

-- Constrainty jen pokud chybí (ne drop — ochrana existujících dat).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'promotion_orders_status_check' and conrelid = 'public.promotion_orders'::regclass
  ) then
    alter table public.promotion_orders
      add constraint promotion_orders_status_check
      check (status in ('inquiry', 'accepted', 'active', 'declined', 'ended'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'promotion_orders_payment_check' and conrelid = 'public.promotion_orders'::regclass
  ) then
    alter table public.promotion_orders
      add constraint promotion_orders_payment_check
      check (payment_status in ('none', 'invoiced', 'paid', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'promotion_orders_plan_check' and conrelid = 'public.promotion_orders'::regclass
  ) then
    alter table public.promotion_orders
      add constraint promotion_orders_plan_check
      check (plan_id in ('start', 'plus', 'premium'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'promotion_orders_period_check' and conrelid = 'public.promotion_orders'::regclass
  ) then
    alter table public.promotion_orders
      add constraint promotion_orders_period_check
      check (period_id in ('mesicne', 'rocne'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'promotion_orders_renewal_check' and conrelid = 'public.promotion_orders'::regclass
  ) then
    alter table public.promotion_orders
      add constraint promotion_orders_renewal_check
      check (renewal = 'none');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'promotion_orders_amount_check' and conrelid = 'public.promotion_orders'::regclass
  ) then
    alter table public.promotion_orders
      add constraint promotion_orders_amount_check
      check (amount > 0 and service_days in (30, 365));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'promotion_orders_vat_check' and conrelid = 'public.promotion_orders'::regclass
  ) then
    alter table public.promotion_orders
      add constraint promotion_orders_vat_check
      check (vat_status in ('unconfirmed', 'non-payer', 'payer'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'promotion_orders_invoice_check' and conrelid = 'public.promotion_orders'::regclass
  ) then
    alter table public.promotion_orders
      add constraint promotion_orders_invoice_check
      check (char_length(invoice_number) <= 40);
  end if;
end $$;

create unique index if not exists promotion_orders_one_open
  on public.promotion_orders (lower(email), plan_id, period_id, place_key)
  where status in ('inquiry', 'accepted', 'active');

alter table public.promotion_orders enable row level security;
alter table public.promotion_payment_events enable row level security;

drop policy if exists promotion_orders_admin_all on public.promotion_orders;
create policy promotion_orders_admin_all
  on public.promotion_orders
  for all
  to authenticated
  using (public.is_cheapeats_admin())
  with check (public.is_cheapeats_admin());

drop policy if exists promotion_payment_events_admin_read on public.promotion_payment_events;
create policy promotion_payment_events_admin_read
  on public.promotion_payment_events
  for select
  to authenticated
  using (public.is_cheapeats_admin());

revoke all on public.promotion_orders from anon, authenticated;
grant select, update on public.promotion_orders to authenticated;

revoke all on public.promotion_payment_events from anon, authenticated;
grant select on public.promotion_payment_events to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Trigger: zamčená pole + zákaz aktivace bez admina / bez paid
-- ---------------------------------------------------------------------------

create or replace function public.guard_promotion_order()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  new.renewal := 'none';
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    if new.reference is distinct from old.reference
       or new.access_hash is distinct from old.access_hash
       or new.amount is distinct from old.amount
       or new.plan_id is distinct from old.plan_id
       or new.period_id is distinct from old.period_id
       or new.currency is distinct from old.currency
       or new.service_days is distinct from old.service_days
       or new.place_key is distinct from old.place_key then
      raise exception 'promotion-fields-locked' using errcode = '23514';
    end if;

    if new.payment_status is distinct from old.payment_status
       and new.payment_status = 'paid'
       and not public.is_cheapeats_admin()
       and current_setting('app.promotion_payment_hook', true) is distinct from '1' then
      raise exception 'payment-requires-admin-or-webhook' using errcode = '42501';
    end if;

    if new.status = 'active'
       and old.status is distinct from 'active'
       and not public.is_cheapeats_admin()
       and current_setting('app.promotion_activation_hook', true) is distinct from '1' then
      raise exception 'activation-requires-admin' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT' and new.status = 'active' then
    raise exception 'activation-requires-payment' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.status = 'active' and old.status is distinct from 'active' then
    if old.payment_status is distinct from 'paid' or old.status not in ('inquiry', 'accepted') then
      raise exception 'activation-requires-payment' using errcode = '23514';
    end if;
  end if;
  if new.status = 'active' then
    if new.payment_status is distinct from 'paid'
       or new.place_id !~ '^[a-z0-9][a-z0-9-]{0,79}$'
       or new.starts_at is null
       or new.ends_at is null
       or new.ends_at <= new.starts_at then
      raise exception 'activation-requires-payment' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_promotion_order on public.promotion_orders;
create trigger guard_promotion_order
  before insert or update on public.promotion_orders
  for each row
  execute function public.guard_promotion_order();

revoke all on function public.guard_promotion_order() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) RPC — chybějící jádro evidence poptávek / plateb
-- ---------------------------------------------------------------------------

create or replace function public.submit_promotion_inquiry(
  p_record jsonb,
  p_access_hash text,
  p_reference text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  monthly integer;
  amount integer;
  days integer;
  period text;
  chosen_plan text;
  chosen_place text;
  chosen_key text;
  chosen_email text;
  chosen_phone text;
  chosen_ico text;
  chosen_dic text;
  chosen_vat text;
  ico_sum integer := 0;
  ico_mod integer;
  ico_check integer;
  i integer;
  existing_id uuid;
  new_id uuid;
begin
  if p_access_hash is null or length(p_access_hash) < 32 or p_reference is null or length(p_reference) > 40 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if coalesce(p_record->>'termsAck', '') <> 'true' then
    return jsonb_build_object('ok', false, 'error', 'terms');
  end if;

  chosen_plan := p_record->>'planId';
  period := p_record->>'periodId';
  monthly := case chosen_plan
    when 'start' then 99
    when 'plus' then 199
    when 'premium' then 399
    else null
  end;
  if monthly is null then
    return jsonb_build_object('ok', false, 'error', 'unknown-plan');
  end if;
  if period = 'rocne' then
    amount := monthly * 10;
    days := 365;
  elsif period = 'mesicne' then
    amount := monthly;
    days := 30;
  else
    return jsonb_build_object('ok', false, 'error', 'unknown-period');
  end if;

  if char_length(btrim(coalesce(p_record->>'businessName', ''))) not between 1 and 100
     or char_length(btrim(coalesce(p_record->>'companyName', ''))) not between 1 and 160
     or char_length(btrim(coalesce(p_record->>'contactName', ''))) not between 1 and 100
     or char_length(btrim(coalesce(p_record->>'billingAddress', ''))) not between 5 and 200
     or char_length(coalesce(p_record->>'description', '')) > 1600
     or char_length(coalesce(p_record->>'extra', '')) > 2000
     or char_length(coalesce(p_record->>'vatNote', '')) > 500
     or char_length(coalesce(p_record->>'website', '')) > 300 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  chosen_email := lower(btrim(coalesce(p_record->>'email', '')));
  if char_length(chosen_email) > 200
     or chosen_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'error', 'email');
  end if;

  chosen_phone := btrim(coalesce(p_record->>'phone', ''));
  if char_length(chosen_phone) > 40
     or length(regexp_replace(chosen_phone, '\D', '', 'g')) < 9
     or length(regexp_replace(chosen_phone, '\D', '', 'g')) > 15 then
    return jsonb_build_object('ok', false, 'error', 'phone');
  end if;

  chosen_ico := regexp_replace(coalesce(p_record->>'ico', ''), '\s', '', 'g');
  if chosen_ico <> '' then
    if chosen_ico !~ '^[0-9]{8}$' then
      return jsonb_build_object('ok', false, 'error', 'ico');
    end if;
    for i in 1..7 loop
      ico_sum := ico_sum + substr(chosen_ico, i, 1)::integer * (9 - i);
    end loop;
    ico_mod := ico_sum % 11;
    if ico_mod = 0 then
      ico_check := 1;
    elsif ico_mod = 1 then
      ico_check := 0;
    else
      ico_check := 11 - ico_mod;
    end if;
    if ico_check <> substr(chosen_ico, 8, 1)::integer then
      return jsonb_build_object('ok', false, 'error', 'ico');
    end if;
  end if;

  chosen_dic := upper(regexp_replace(coalesce(p_record->>'dic', ''), '\s', '', 'g'));
  if chosen_dic <> '' and chosen_dic !~ '^CZ[0-9]{8,10}$' then
    return jsonb_build_object('ok', false, 'error', 'dic');
  end if;

  chosen_place := coalesce(p_record->>'placeId', '');
  if chosen_place <> '' and chosen_place !~ '^[a-z0-9][a-z0-9-]{0,79}$' then
    return jsonb_build_object('ok', false, 'error', 'place');
  end if;
  chosen_key := case
    when chosen_place <> '' then 'id:' || chosen_place
    else 'name:' || lower(btrim(coalesce(p_record->>'businessName', '')))
  end;

  chosen_vat := coalesce(p_record->>'vatStatus', 'unconfirmed');
  if chosen_vat not in ('unconfirmed', 'non-payer', 'payer') then
    chosen_vat := 'unconfirmed';
  end if;

  if (
    select count(*)
    from public.promotion_orders
    where lower(promotion_orders.email) = chosen_email
      and promotion_orders.created_at > now() - interval '1 hour'
  ) >= 3 then
    return jsonb_build_object('ok', false, 'error', 'rate-limited');
  end if;

  select id into existing_id
  from public.promotion_orders
  where lower(promotion_orders.email) = chosen_email
    and promotion_orders.plan_id = chosen_plan
    and promotion_orders.period_id = period
    and promotion_orders.place_key = chosen_key
    and promotion_orders.status in ('inquiry', 'accepted', 'active')
  limit 1;
  if existing_id is not null then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;

  insert into public.promotion_orders (
    reference, access_hash, status, payment_status, renewal,
    plan_id, plan_name, period_id, amount, currency, service_days, service_label,
    vat_status, vat_note, place_id, place_key, business_name, company_name,
    ico, dic, contact_name, email, phone, billing_address, website, description, note
  ) values (
    p_reference,
    p_access_hash,
    'inquiry',
    'none',
    'none',
    chosen_plan,
    left(coalesce(p_record->>'planName', chosen_plan), 40),
    period,
    amount,
    'CZK',
    days,
    left(coalesce(p_record->>'serviceLabel', ''), 80),
    chosen_vat,
    left(coalesce(p_record->>'vatNote', ''), 500),
    chosen_place,
    chosen_key,
    btrim(p_record->>'businessName'),
    btrim(p_record->>'companyName'),
    chosen_ico,
    chosen_dic,
    btrim(p_record->>'contactName'),
    btrim(p_record->>'email'),
    chosen_phone,
    btrim(p_record->>'billingAddress'),
    left(coalesce(p_record->>'website', ''), 300),
    left(coalesce(p_record->>'description', ''), 1600),
    left(coalesce(p_record->>'extra', ''), 2000)
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id, 'reference', p_reference);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
end;
$$;

create or replace function public.read_promotion_inquiry(
  p_reference text,
  p_access_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  found_order public.promotion_orders;
begin
  select * into found_order
  from public.promotion_orders
  where reference = p_reference
    and access_hash = encode(digest(convert_to(coalesce(p_access_key, ''), 'UTF8'), 'sha256'), 'hex');
  if not found then
    return jsonb_build_object('ok', false, 'error', 'missing');
  end if;
  return jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'reference', found_order.reference,
      'status', found_order.status,
      'paymentStatus', found_order.payment_status,
      'planId', found_order.plan_id,
      'planName', found_order.plan_name,
      'periodId', found_order.period_id,
      'amount', found_order.amount,
      'currency', found_order.currency,
      'serviceDays', found_order.service_days,
      'serviceLabel', found_order.service_label,
      'renewal', 'none',
      'vatStatus', found_order.vat_status,
      'vatNote', found_order.vat_note,
      'placeId', found_order.place_id,
      'businessName', found_order.business_name,
      'paid', found_order.payment_status = 'paid',
      'activated', found_order.status = 'active'
    )
  );
end;
$$;

-- Zapisuje jen payment_status (paid/failed). NIKDY nenastaví status = 'active'.
-- Aktivaci dělá admin přes API (payments.js / admin review), ne tento RPC.
create or replace function public.record_verified_payment(
  p_event_id text,
  p_reference text,
  p_status text,
  p_secret text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  jwt_role text;
  inserted integer;
  stored_status text;
  found_order public.promotion_orders;
begin
  -- p_secret se neporovnává a neukládá. Comgate secret zůstává jen v env serveru.
  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if jwt_role in ('anon', 'authenticated') or (jwt_role <> '' and jwt_role <> 'service_role') then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_event_id is null or char_length(p_event_id) not between 1 and 120
     or p_reference is null or char_length(p_reference) > 40
     or p_status not in ('paid', 'failed', 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'invalid-event');
  end if;

  insert into public.promotion_payment_events (event_id, reference, status)
  values (p_event_id, p_reference, p_status)
  on conflict (event_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    select status into stored_status
    from public.promotion_payment_events
    where event_id = p_event_id;
    if stored_status is distinct from p_status then
      return jsonb_build_object('ok', false, 'error', 'event-conflict', 'activated', false);
    end if;
  end if;

  perform set_config('app.promotion_payment_hook', '1', true);

  if p_status = 'paid' then
    update public.promotion_orders
      set payment_status = 'paid',
          payment_source = 'gateway',
          paid_at = now(),
          renewal = 'none'
      where reference = p_reference
        and payment_status <> 'paid'
        and status in ('inquiry', 'accepted');
  elsif p_status in ('failed', 'cancelled') then
    update public.promotion_orders
      set payment_status = 'failed'
      where reference = p_reference
        and payment_status <> 'paid'
        and status in ('inquiry', 'accepted');
  end if;

  select * into found_order from public.promotion_orders where reference = p_reference;
  return jsonb_build_object(
    'ok', true,
    'duplicate', inserted = 0,
    'activated', false,
    'reference', p_reference,
    'status', found_order.status,
    'paymentStatus', found_order.payment_status,
    'placeId', found_order.place_id,
    'serviceDays', found_order.service_days,
    'endsAt', found_order.ends_at
  );
end;
$$;

-- Aktivace po už zapsané úhradě. service_role, ne anon. Trigger pustí jen s příznakem níže.
create or replace function public.activate_verified_promotion(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  jwt_role text;
  found_order public.promotion_orders;
begin
  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if jwt_role in ('anon', 'authenticated') or (jwt_role <> '' and jwt_role <> 'service_role') then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'activated', false);
  end if;

  select * into found_order
  from public.promotion_orders
  where reference = p_reference;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'missing', 'activated', false);
  end if;

  if found_order.status = 'active' and found_order.payment_status = 'paid' then
    return jsonb_build_object(
      'ok', true,
      'activated', true,
      'duplicate', true,
      'status', found_order.status,
      'placeId', found_order.place_id,
      'endsAt', found_order.ends_at
    );
  end if;

  if found_order.payment_status is distinct from 'paid'
     or found_order.status not in ('inquiry', 'accepted') then
    return jsonb_build_object('ok', false, 'error', 'not-activatable', 'activated', false);
  end if;

  if found_order.place_id !~ '^[a-z0-9][a-z0-9-]{0,79}$' then
    return jsonb_build_object('ok', false, 'error', 'place', 'activated', false);
  end if;

  perform set_config('app.promotion_activation_hook', '1', true);

  update public.promotion_orders
    set status = 'active',
        starts_at = now(),
        ends_at = now() + make_interval(days => found_order.service_days),
        activated_at = now(),
        renewal = 'none'
    where id = found_order.id
      and payment_status = 'paid'
      and status in ('inquiry', 'accepted');

  select * into found_order
  from public.promotion_orders
  where reference = p_reference;

  if found_order.status is distinct from 'active' then
    return jsonb_build_object('ok', false, 'error', 'activation-failed', 'activated', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'activated', true,
    'duplicate', false,
    'status', found_order.status,
    'placeId', found_order.place_id,
    'endsAt', found_order.ends_at
  );
end;
$$;

revoke all on function public.submit_promotion_inquiry(jsonb, text, text) from public, anon, authenticated;
revoke all on function public.read_promotion_inquiry(text, text) from public, anon, authenticated;
revoke all on function public.record_verified_payment(text, text, text, text) from public, anon, authenticated;
revoke all on function public.activate_verified_promotion(text) from public, anon, authenticated;
-- Submit, čtení i úhrada jen service_role. Anon by obešel serverový rate limit.
grant execute on function public.submit_promotion_inquiry(jsonb, text, text) to service_role;
grant execute on function public.read_promotion_inquiry(text, text) to service_role;
grant execute on function public.record_verified_payment(text, text, text, text) to service_role;
grant execute on function public.activate_verified_promotion(text) to service_role;

create or replace view public.promotion_sponsorships_public
with (security_invoker = false) as
select place_id, plan_id, starts_at, ends_at
from public.promotion_orders
where status = 'active'
  and payment_status = 'paid'
  and place_id <> ''
  and starts_at is not null
  and ends_at is not null
  and starts_at <= now()
  and ends_at > now();

revoke all on public.promotion_sponsorships_public from public, anon, authenticated;
grant select on public.promotion_sponsorships_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Owners + audit (dříve chyběly celé tabulky)
-- ---------------------------------------------------------------------------

create table if not exists public.place_owner_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  place_id text not null,
  email text not null,
  status text not null default 'pending',
  evidence text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'place_owner_claims_status_check'
      and conrelid = 'public.place_owner_claims'::regclass
  ) then
    alter table public.place_owner_claims
      add constraint place_owner_claims_status_check
      check (status in ('pending', 'verified', 'rejected'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'place_owner_claims_place_check'
      and conrelid = 'public.place_owner_claims'::regclass
  ) then
    alter table public.place_owner_claims
      add constraint place_owner_claims_place_check
      check (place_id ~ '^[a-z0-9][a-z0-9-]{0,79}$');
  end if;
end $$;

create table if not exists public.promotion_audit_log (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null default '',
  event_id text not null default '',
  action text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

alter table public.place_owner_claims enable row level security;
alter table public.promotion_audit_log enable row level security;

drop policy if exists place_owner_claims_admin_all on public.place_owner_claims;
drop policy if exists place_owner_claims_admin_select on public.place_owner_claims;
create policy place_owner_claims_admin_select
  on public.place_owner_claims
  for select
  to authenticated
  using (public.is_cheapeats_admin());

drop policy if exists place_owner_claims_select_own on public.place_owner_claims;
create policy place_owner_claims_select_own
  on public.place_owner_claims
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists place_owner_claims_insert_own on public.place_owner_claims;
create policy place_owner_claims_insert_own
  on public.place_owner_claims
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and char_length(email) between 3 and 200
    and char_length(evidence) <= 2000
  );

drop policy if exists promotion_audit_admin_read on public.promotion_audit_log;
create policy promotion_audit_admin_read
  on public.promotion_audit_log
  for select
  to authenticated
  using (public.is_cheapeats_admin());

revoke all on public.place_owner_claims from anon, authenticated;
grant select on public.place_owner_claims to authenticated;
grant insert on public.place_owner_claims to authenticated;

revoke all on public.promotion_audit_log from anon, authenticated;
grant select on public.promotion_audit_log to authenticated;

-- Schválení jen přihlášený admin a nikdy vlastní žádost. Přímý UPDATE authenticated nemá.
create or replace function public.review_place_owner_claim(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claim public.place_owner_claims;
begin
  if not public.is_cheapeats_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_status not in ('verified', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select * into claim from public.place_owner_claims where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'missing');
  end if;
  if claim.user_id is not distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'self-review');
  end if;
  update public.place_owner_claims
    set status = p_status,
        reviewed_at = now()
    where id = p_id;
  insert into public.promotion_audit_log (order_reference, action, detail)
  values ('', 'owner-claim', left(p_status || ':' || p_id::text, 180));
  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

revoke all on function public.review_place_owner_claim(uuid, text) from public, anon, authenticated;
grant execute on function public.review_place_owner_claim(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Profil: klient si nesmí nastavit is_admin
-- ---------------------------------------------------------------------------

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

revoke all on function public.protect_profiles_row() from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'display_name'
  ) then
    revoke update on public.profiles from anon, authenticated;
    grant update (display_name) on public.profiles to authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6) Self-check (žádná data se nemění)
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.submit_promotion_inquiry(jsonb, text, text)') is null
     or to_regprocedure('public.read_promotion_inquiry(text, text)') is null
     or to_regprocedure('public.record_verified_payment(text, text, text, text)') is null
     or to_regprocedure('public.activate_verified_promotion(text)') is null
     or to_regprocedure('public.review_place_owner_claim(uuid, text)') is null
     or to_regprocedure('public.guard_promotion_order()') is null then
    raise exception 'migrace nedokončena — chybí RPC/trigger';
  end if;
  if to_regclass('public.place_owner_claims') is null
     or to_regclass('public.promotion_audit_log') is null then
    raise exception 'migrace nedokončena — chybí owners tabulky';
  end if;
  if has_function_privilege('anon', 'public.submit_promotion_inquiry(jsonb, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.submit_promotion_inquiry(jsonb, text, text)', 'execute')
     or has_function_privilege('anon', 'public.read_promotion_inquiry(text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.read_promotion_inquiry(text, text)', 'execute')
     or has_function_privilege('anon', 'public.record_verified_payment(text, text, text, text)', 'execute')
     or has_function_privilege('anon', 'public.activate_verified_promotion(text)', 'execute') then
    raise exception 'migrace nedokončena — anon/authenticated nesmí volat serverové RPC';
  end if;
  if has_function_privilege('service_role', 'public.submit_promotion_inquiry(jsonb, text, text)', 'execute') is not true
     or has_function_privilege('service_role', 'public.activate_verified_promotion(text)', 'execute') is not true then
    raise exception 'migrace nedokončena — service_role nemá execute';
  end if;
  raise notice 'promotion-apply-missing: OK — RPC, guard, owners, profil připraveny';
end $$;

-- #############################################################################
-- END supabase/promotion-apply-missing.sql
-- #############################################################################


-- #############################################################################
-- BEGIN supabase/place-reports.sql
-- #############################################################################

-- BLOCKED: nenasazovat bez výslovného souhlasu vlastníka.
-- Hlášení chyb o podnicích. Neověřená hlášení nejsou veřejná.
-- Předpoklad: public.profiles + public.is_cheapeats_admin() (bootstrap-all).

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'place-reports.sql: nejdřív spusť supabase/bootstrap-all.sql (profiles).';
  end if;
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_cheapeats_admin'
  ) then
    raise exception 'place-reports.sql: chybí public.is_cheapeats_admin().';
  end if;
end $$;

create table if not exists public.place_reports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null,
  reason text not null,
  details text not null,
  contact text,
  created_at timestamptz not null default now(),
  status text not null default 'new',
  constraint place_reports_restaurant_id_format
    check (restaurant_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  constraint place_reports_reason_check
    check (reason in ('address', 'price', 'closed', 'photo', 'category', 'other')),
  constraint place_reports_details_length
    check (char_length(details) between 8 and 1200),
  constraint place_reports_contact_length
    check (contact is null or (char_length(contact) between 1 and 120 and position(E'\n' in contact) = 0)),
  constraint place_reports_status_check
    check (status in ('new', 'reviewing', 'resolved', 'dismissed'))
);

create index if not exists place_reports_created_idx
  on public.place_reports (created_at desc);

create index if not exists place_reports_status_idx
  on public.place_reports (status, created_at desc);

alter table public.place_reports enable row level security;

revoke all on table public.place_reports from anon, authenticated, public;
grant select, update on table public.place_reports to authenticated;

drop policy if exists place_reports_admin_select on public.place_reports;
create policy place_reports_admin_select
  on public.place_reports
  for select
  to authenticated
  using (public.is_cheapeats_admin());

drop policy if exists place_reports_admin_update on public.place_reports;
create policy place_reports_admin_update
  on public.place_reports
  for update
  to authenticated
  using (public.is_cheapeats_admin())
  with check (public.is_cheapeats_admin());

-- Veřejný zápis přes RPC (server volá s anon key). Nevrací citlivý obsah.
create or replace function public.submit_place_report(
  p_restaurant_id text,
  p_reason text,
  p_details text,
  p_contact text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
  clean_contact text;
begin
  clean_contact := nullif(btrim(coalesce(p_contact, '')), '');
  insert into public.place_reports (restaurant_id, reason, details, contact, status)
  values (
    btrim(p_restaurant_id),
    btrim(p_reason),
    btrim(p_details),
    clean_contact,
    'new'
  )
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.submit_place_report(text, text, text, text) from public;
grant execute on function public.submit_place_report(text, text, text, text) to anon, authenticated;

-- #############################################################################
-- END supabase/place-reports.sql
-- #############################################################################


-- #############################################################################
-- BEGIN supabase/place-overrides.sql
-- #############################################################################

-- BLOCKED: nenasazovat na produkci bez výslovného souhlasu.
-- Přepisy katalogu (skrytí / úprava jména, adresy, kategorie).
-- Statických 775 podniků se nemění; runtime je sloučí přes /api/place-overrides.
-- Předpoklad: public.profiles + public.is_cheapeats_admin() (bootstrap-all).

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'place-overrides.sql: nejdřív spusť supabase/bootstrap-all.sql (profiles).';
  end if;
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_cheapeats_admin'
  ) then
    raise exception 'place-overrides.sql: chybí public.is_cheapeats_admin().';
  end if;
end $$;

create table if not exists public.place_overrides (
  place_id text primary key,
  hidden boolean not null default false,
  name text,
  address text,
  category text,
  admin_note text,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint place_overrides_place_id_format
    check (place_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  constraint place_overrides_name_len
    check (name is null or char_length(btrim(name)) between 2 and 160),
  constraint place_overrides_address_len
    check (address is null or char_length(btrim(address)) between 3 and 240),
  constraint place_overrides_category_len
    check (category is null or char_length(btrim(category)) between 2 and 80),
  constraint place_overrides_note_len
    check (admin_note is null or char_length(admin_note) <= 1000)
);

create index if not exists place_overrides_hidden_idx
  on public.place_overrides (hidden)
  where hidden = true;

alter table public.place_overrides enable row level security;

revoke all on table public.place_overrides from anon, authenticated, public;
-- Veřejný čtení jen sloupců, které jdou do katalogu (bez admin_note přes view).
grant select on table public.place_overrides to anon, authenticated;
grant select, insert, update, delete on table public.place_overrides to authenticated;

drop policy if exists place_overrides_public_select on public.place_overrides;
create policy place_overrides_public_select
  on public.place_overrides
  for select
  to anon, authenticated
  using (true);

drop policy if exists place_overrides_admin_insert on public.place_overrides;
create policy place_overrides_admin_insert
  on public.place_overrides
  for insert
  to authenticated
  with check (public.is_cheapeats_admin());

drop policy if exists place_overrides_admin_update on public.place_overrides;
create policy place_overrides_admin_update
  on public.place_overrides
  for update
  to authenticated
  using (public.is_cheapeats_admin())
  with check (public.is_cheapeats_admin());

drop policy if exists place_overrides_admin_delete on public.place_overrides;
create policy place_overrides_admin_delete
  on public.place_overrides
  for delete
  to authenticated
  using (public.is_cheapeats_admin());

-- Veřejné view bez interní poznámky.
create or replace view public.place_overrides_public
with (security_invoker = true)
as
select place_id, hidden, name, address, category, updated_at
from public.place_overrides;

revoke all on public.place_overrides_public from public;
grant select on public.place_overrides_public to anon, authenticated;

-- #############################################################################
-- END supabase/place-overrides.sql
-- #############################################################################


-- #############################################################################
-- BEGIN supabase/place-stats.sql
-- #############################################################################

-- BLOCKED: nenasazovat bez výslovného souhlasu vlastníka.
-- Agregované statistiky profilu (bez přesné polohy uživatele).
-- Předpoklad: public.profiles + public.is_cheapeats_admin() (bootstrap-all).

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'place-stats.sql: nejdřív spusť supabase/bootstrap-all.sql (profiles).';
  end if;
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_cheapeats_admin'
  ) then
    raise exception 'place-stats.sql: chybí public.is_cheapeats_admin().';
  end if;
end $$;

create table if not exists public.place_stats_daily (
  restaurant_id text not null,
  day date not null,
  profile_views int not null default 0,
  route_clicks int not null default 0,
  website_clicks int not null default 0,
  phone_clicks int not null default 0,
  primary key (restaurant_id, day),
  constraint place_stats_restaurant_id_format
    check (restaurant_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  constraint place_stats_nonneg
    check (
      profile_views >= 0
      and route_clicks >= 0
      and website_clicks >= 0
      and phone_clicks >= 0
    )
);

create index if not exists place_stats_daily_day_idx
  on public.place_stats_daily (day desc);

alter table public.place_stats_daily enable row level security;

revoke all on table public.place_stats_daily from anon, authenticated, public;
grant select on table public.place_stats_daily to authenticated;

drop policy if exists place_stats_admin_select on public.place_stats_daily;
create policy place_stats_admin_select
  on public.place_stats_daily
  for select
  to authenticated
  using (public.is_cheapeats_admin());

-- Zápis jen přes RPC. directions_click i legacy route_click → route_clicks.
create or replace function public.record_place_stat(
  p_restaurant_id text,
  p_event text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rid text := btrim(coalesce(p_restaurant_id, ''));
  ev text := btrim(coalesce(p_event, ''));
  col text;
begin
  if rid = '' or rid !~ '^[a-z0-9][a-z0-9-]{0,119}$' then
    return false;
  end if;
  if ev = 'profile_view' then
    col := 'profile_views';
  elsif ev in ('route_click', 'directions_click') then
    col := 'route_clicks';
  elsif ev = 'website_click' then
    col := 'website_clicks';
  elsif ev = 'phone_click' then
    col := 'phone_clicks';
  else
    return false;
  end if;

  insert into public.place_stats_daily (restaurant_id, day)
  values (rid, (timezone('Europe/Prague', now()))::date)
  on conflict (restaurant_id, day) do nothing;

  if col = 'profile_views' then
    update public.place_stats_daily
    set profile_views = profile_views + 1
    where restaurant_id = rid and day = (timezone('Europe/Prague', now()))::date;
  elsif col = 'route_clicks' then
    update public.place_stats_daily
    set route_clicks = route_clicks + 1
    where restaurant_id = rid and day = (timezone('Europe/Prague', now()))::date;
  elsif col = 'website_clicks' then
    update public.place_stats_daily
    set website_clicks = website_clicks + 1
    where restaurant_id = rid and day = (timezone('Europe/Prague', now()))::date;
  else
    update public.place_stats_daily
    set phone_clicks = phone_clicks + 1
    where restaurant_id = rid and day = (timezone('Europe/Prague', now()))::date;
  end if;

  return true;
end;
$$;

revoke all on function public.record_place_stat(text, text) from public;
grant execute on function public.record_place_stat(text, text) to anon, authenticated;

-- #############################################################################
-- END supabase/place-stats.sql
-- #############################################################################


-- #############################################################################
-- BEGIN supabase/preview-synthetic-seed.sql
-- #############################################################################

-- Syntetická data pro prázdný projekt foodgo-preview (jnyxjyyvzxriuyvyiuxe).
-- NESPUSŤ na produkčním projektu pcptzyfoojmnspumcmsi.
-- Žádní skuteční zákazníci, hesla, kontakty ani objednávky.
--
-- Na skutečném Supabase NEVKLÁDÁME řádky do auth.users (má povinné sloupce).
-- Izolovaný Docker fixture má zjednodušené auth.users — tam se uživatel vloží jen když jde.

do $$
begin
  if to_regclass('auth.users') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'auth'
         and table_name = 'users'
         and column_name = 'encrypted_password'
     ) then
    raise notice 'preview-seed: skutečný Supabase Auth — přeskakuji insert do auth.users';
  else
    insert into auth.users (id, email)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'preview-user@example.com')
    on conflict (id) do nothing;
  end if;
exception
  when others then
    raise notice 'preview-seed: auth.users insert přeskočen (% )', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from auth.users where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') then
    insert into public.profiles (id, email, is_admin)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'preview-user@example.com', false)
    on conflict (id) do nothing;
  end if;
exception
  when others then
    raise notice 'preview-seed: profiles insert přeskočen (% )', sqlerrm;
end $$;

insert into public.promotion_orders (
  reference, access_hash, status, payment_status, renewal,
  plan_id, plan_name, period_id, amount, currency, service_days, service_label,
  vat_status, place_id, place_key, business_name, company_name,
  contact_name, email, phone, billing_address
)
select
  'CEPREVIEW1',
  repeat('ab', 32),
  'inquiry',
  'none',
  'none',
  'start',
  'Start',
  'mesicne',
  99,
  'CZK',
  30,
  '30 dní',
  'non-payer',
  'preview-bistro',
  'id:preview-bistro',
  'Preview Bistro',
  'Preview s.r.o.',
  'Test Preview',
  'preview-bistro@example.com',
  '+420700000001',
  'Testovací 1, Brno'
where not exists (
  select 1 from public.promotion_orders where reference = 'CEPREVIEW1'
);

-- #############################################################################
-- END supabase/preview-synthetic-seed.sql
-- #############################################################################

