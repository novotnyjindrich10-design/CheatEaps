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
