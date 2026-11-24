-- FoodGo: ověření vlastníků, audit a historie propagace.
-- NESPUSŤ bez výslovného schválení. Soubor není součást supabase/bootstrap-all.sql
-- a tento test ani deploy ho nespouští.
--
-- Pořadí migrací (testovací DB → teprve produkce po schválení):
-- 1) supabase/auth-rls.sql (+ business-applications.sql) — is_cheapeats_admin()
-- 2) supabase/promotion-orders.sql — objednávky / RPC plateb
-- 3) tento soubor — place_owner_claims + promotion_audit_log
-- Rollback: drop table public.promotion_audit_log; drop table public.place_owner_claims;
-- (promotion_orders tím nesmažeš).
-- Nemění a nemaže public.promotion_orders, profily, restaurace ani recenze.
-- Vyžaduje public.is_cheapeats_admin() z dříve schváleného auth SQL.
-- Aktivaci reklamy po Comgate push řeší server payments.js + promotion-orders.sql.

do $$
begin
  if to_regprocedure('public.is_cheapeats_admin()') is null then
    raise exception 'chybí public.is_cheapeats_admin()';
  end if;
end $$;

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

alter table public.place_owner_claims drop constraint if exists place_owner_claims_status_check;
alter table public.place_owner_claims
  add constraint place_owner_claims_status_check
  check (status in ('pending', 'verified', 'rejected'));

alter table public.place_owner_claims drop constraint if exists place_owner_claims_place_check;
alter table public.place_owner_claims
  add constraint place_owner_claims_place_check
  check (place_id ~ '^[a-z0-9][a-z0-9-]{0,79}$');

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
