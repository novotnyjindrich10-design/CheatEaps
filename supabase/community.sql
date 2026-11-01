-- CheapEats: oblíbené restaurace a recenze zákazníků.
-- Nejdřív musí existovat public.profiles. Když ne, spusť supabase/auth-rls.sql a tenhle soubor znovu.
-- Doporučení: místo jednotlivých souborů spusť jednou supabase/bootstrap-all.sql.
-- V Supabase: SQL Editor → vložit celý soubor → Run.
-- Soubor je možné spustit znovu. Nemaze existující oblíbené ani recenze.
-- Restaurace žijí v katalogu aplikace, ne v téhle databázi, proto restaurant_id je text.
-- E-mail autora se do recenze neukládá.

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Nejdřív spusť supabase/auth-rls.sql';
  end if;
end $$;

alter table public.profiles
  add column if not exists display_name text;

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

insert into public.profiles (id, email)
select users.id, users.email
from auth.users as users
where not exists (
  select 1 from public.profiles as profiles where profiles.id = users.id
)
on conflict (id) do nothing;

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

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
  on public.favorites
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
  on public.favorites
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
  on public.favorites
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reviews_select_public" on public.reviews;
create policy "reviews_select_public"
  on public.reviews
  for select
  to anon, authenticated
  using (true);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
  on public.reviews
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own"
  on public.reviews
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own"
  on public.reviews
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "review_reports_select_own" on public.review_reports;
create policy "review_reports_select_own"
  on public.review_reports
  for select
  to authenticated
  using (auth.uid() = reporter_id);

drop policy if exists "review_reports_insert_own" on public.review_reports;
create policy "review_reports_insert_own"
  on public.review_reports
  for insert
  to authenticated
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
set search_path = public
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
set search_path = public
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
set search_path = public
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

revoke all on function public.protect_favorite() from public, anon, authenticated;
revoke all on function public.protect_review() from public, anon, authenticated;
revoke all on function public.review_author_label(uuid) from public, anon, authenticated;
