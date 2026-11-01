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
