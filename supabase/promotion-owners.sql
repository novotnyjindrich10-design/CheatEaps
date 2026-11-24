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
create policy place_owner_claims_admin_all
  on public.place_owner_claims
  for all
  to authenticated
  using (public.is_cheapeats_admin())
  with check (public.is_cheapeats_admin());

drop policy if exists place_owner_claims_insert_own on public.place_owner_claims;
create policy place_owner_claims_insert_own
  on public.place_owner_claims
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
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
