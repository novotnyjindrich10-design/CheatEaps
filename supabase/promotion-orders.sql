-- CheapEats: poptávky placené propagace a veřejný výpis aktivních reklam.
-- NESPUSŤ bez výslovného schválení. Soubor je připravený pro Supabase SQL Editor,
-- ale sám o sobě není provedená produkční migrace.
-- Není součást supabase/bootstrap-all.sql.
-- Nemění a nemaže existující restaurace, uživatele, recenze ani žádosti o katalog.
-- Nejdřív musí běžet supabase/auth-rls.sql a supabase/business-applications.sql
-- (nebo jednou supabase/bootstrap-all.sql): public.profiles, profiles.is_admin,
-- funkce public.is_cheapeats_admin().
--
-- Po schváleném spuštění, a až budeš chtít přijímat webhook plateb:
-- 1) Na serveru nastav SUPABASE_SERVICE_ROLE_KEY (jen backend, nikdy VITE_*).
-- 2) V SQL editoru nastav tajemství dlouhé aspoň 16 znaků. Do tohoto souboru ho nepiš:
--      alter database postgres set app.payment_webhook_secret = 'nahraď-vlastním-tajemstvím';
--    Stejnou hodnotu dej do PAYMENT_WEBHOOK_SECRET na serveru.
-- Dokud service_role nebo tajemství chybí, webhook úhradu nezapíše.
-- Webhook ani návrat z brány reklamu nezapnou — aktivaci dělá jen admin.
-- record_verified_payment nemá EXECUTE pro anon/authenticated.

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'chybí public.profiles — nejdřív supabase/auth-rls.sql';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_admin'
  ) then
    raise exception 'chybí profiles.is_admin — nejdřív supabase/business-applications.sql';
  end if;
  if to_regprocedure('public.is_cheapeats_admin()') is null then
    raise exception 'chybí public.is_cheapeats_admin()';
  end if;
end $$;

create extension if not exists pgcrypto with schema extensions;

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

alter table public.promotion_orders drop constraint if exists promotion_orders_status_check;
alter table public.promotion_orders
  add constraint promotion_orders_status_check
  check (status in ('inquiry', 'accepted', 'active', 'declined', 'ended'));

alter table public.promotion_orders drop constraint if exists promotion_orders_payment_check;
alter table public.promotion_orders
  add constraint promotion_orders_payment_check
  check (payment_status in ('none', 'invoiced', 'paid', 'failed'));

alter table public.promotion_orders drop constraint if exists promotion_orders_plan_check;
alter table public.promotion_orders
  add constraint promotion_orders_plan_check
  check (plan_id in ('start', 'plus', 'premium'));

alter table public.promotion_orders drop constraint if exists promotion_orders_period_check;
alter table public.promotion_orders
  add constraint promotion_orders_period_check
  check (period_id in ('mesicne', 'rocne'));

alter table public.promotion_orders drop constraint if exists promotion_orders_renewal_check;
alter table public.promotion_orders
  add constraint promotion_orders_renewal_check
  check (renewal = 'none');

alter table public.promotion_orders drop constraint if exists promotion_orders_amount_check;
alter table public.promotion_orders
  add constraint promotion_orders_amount_check
  check (amount > 0 and service_days in (30, 365));

alter table public.promotion_orders drop constraint if exists promotion_orders_vat_check;
alter table public.promotion_orders
  add constraint promotion_orders_vat_check
  check (vat_status in ('unconfirmed', 'non-payer', 'payer'));

alter table public.promotion_orders drop constraint if exists promotion_orders_invoice_check;
alter table public.promotion_orders
  add constraint promotion_orders_invoice_check
  check (char_length(invoice_number) <= 40);

create unique index if not exists promotion_orders_one_open
  on public.promotion_orders (lower(email), plan_id, period_id, place_key)
  where status in ('inquiry', 'accepted', 'active');

create table if not exists public.promotion_payment_events (
  event_id text primary key,
  reference text not null,
  status text not null,
  received_at timestamptz not null default now()
);

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
       and not public.is_cheapeats_admin() then
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
  inserted integer;
begin
  if length(coalesce(current_setting('app.payment_webhook_secret', true), '')) < 16
     or p_secret is distinct from current_setting('app.payment_webhook_secret', true) then
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
    return jsonb_build_object('ok', true, 'duplicate', true, 'activated', false);
  end if;

  -- Jednorázový příznak pro trigger: úhradu smí zapsat admin nebo ověřený webhook.
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

  return jsonb_build_object('ok', true, 'duplicate', false, 'activated', false);
end;
$$;

revoke all on function public.submit_promotion_inquiry(jsonb, text, text) from public, anon, authenticated;
revoke all on function public.read_promotion_inquiry(text, text) from public, anon, authenticated;
revoke all on function public.record_verified_payment(text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_promotion_inquiry(jsonb, text, text) to anon, authenticated;
grant execute on function public.read_promotion_inquiry(text, text) to anon, authenticated;
-- Potvrzení úhrady jen důvěryhodná serverová cesta (service_role), ne veřejné RPC.
grant execute on function public.record_verified_payment(text, text, text, text) to service_role;

-- Pohled běží jako vlastník, protože anonymní role tabulku číst nesmí.
-- Vrací jen identifikátor podniku, balíček a okno platnosti. Kontaktní údaje ne.
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
