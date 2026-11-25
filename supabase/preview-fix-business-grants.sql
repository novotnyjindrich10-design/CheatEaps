-- FoodGo Preview only (jnyxjyyvzxriuyvyiuxe).
-- Oprava GRANT/RLS pro veřejný insert business_applications.
-- Nespouštěj na produkci pcptzyfoojmnspumcmsi.

do $$
begin
  raise notice 'Ověř projekt foodgo-preview jnyxjyyvzxriuyvyiuxe (ne produkci).';
end $$;

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

-- Kontrola
select
  has_table_privilege('anon', 'public.business_applications', 'insert') as anon_can_insert,
  has_table_privilege('authenticated', 'public.business_applications', 'insert') as auth_can_insert;
