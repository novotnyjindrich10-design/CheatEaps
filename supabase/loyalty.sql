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
