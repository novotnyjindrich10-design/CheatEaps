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
