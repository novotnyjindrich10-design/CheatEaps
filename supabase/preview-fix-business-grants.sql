-- FoodGo Preview only (jnyxjyyvzxriuyvyiuxe / foodgo-preview).
-- Oprava GRANT + RLS pro veřejný insert business_applications.
-- Nespouštěj na produkci pcptzyfoojmnspumcmsi.
--
-- Bezpečnostní model:
-- - anon: jen INSERT (žádný SELECT/UPDATE/DELETE) — API nepotřebuje RETURNING
-- - authenticated: SELECT/UPDATE jen přes admin RLS (is_cheapeats_admin)
-- - INSERT WITH CHECK vynucuje pending/start/not_sent a prázdná admin pole
-- - published_places: veřejný SELECT; zápis jen admin

do $$
begin
  if current_database() is null then
    raise notice 'Kontrola: ověř v UI, že jsi v foodgo-preview (jnyxjyyvzxriuyvyiuxe).';
  end if;
  raise notice 'Spouštím preview-fix-business-grants — jen foodgo-preview jnyxjyyvzxriuyvyiuxe.';
end $$;

alter table public.business_applications enable row level security;
alter table public.published_places enable row level security;

-- Minimální oprávnění (žádný DELETE, anon bez čtení žádostí)
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

-- SELECT/UPDATE jen admin (GRANT samotný nestačí — bez této politiky RLS všechno zamítne)
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

-- Kontrola práv a politik
select
  has_table_privilege('anon', 'public.business_applications', 'insert') as anon_can_insert,
  has_table_privilege('anon', 'public.business_applications', 'select') as anon_can_select,
  has_table_privilege('anon', 'public.business_applications', 'update') as anon_can_update,
  has_table_privilege('anon', 'public.business_applications', 'delete') as anon_can_delete,
  has_table_privilege('authenticated', 'public.business_applications', 'insert') as auth_can_insert,
  has_table_privilege('authenticated', 'public.business_applications', 'select') as auth_can_select,
  has_table_privilege('authenticated', 'public.business_applications', 'update') as auth_can_update,
  has_table_privilege('authenticated', 'public.business_applications', 'delete') as auth_can_delete;

select pol.polname as policy, pol.polcmd as cmd
from pg_policy pol
join pg_class cls on cls.oid = pol.polrelid
join pg_namespace nsp on nsp.oid = cls.relnamespace
where nsp.nspname = 'public'
  and cls.relname in ('business_applications', 'published_places')
order by cls.relname, pol.polname;
