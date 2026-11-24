-- BLOCKED: nenasazovat na produkci bez výslovného souhlasu.
-- Přepisy katalogu (skrytí / úprava jména, adresy, kategorie).
-- Statických 775 podniků se nemění; runtime je sloučí přes /api/place-overrides.
-- Předpoklad: public.profiles + public.is_cheapeats_admin() (bootstrap-all).

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'place-overrides.sql: nejdřív spusť supabase/bootstrap-all.sql (profiles).';
  end if;
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_cheapeats_admin'
  ) then
    raise exception 'place-overrides.sql: chybí public.is_cheapeats_admin().';
  end if;
end $$;

create table if not exists public.place_overrides (
  place_id text primary key,
  hidden boolean not null default false,
  name text,
  address text,
  category text,
  admin_note text,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint place_overrides_place_id_format
    check (place_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  constraint place_overrides_name_len
    check (name is null or char_length(btrim(name)) between 2 and 160),
  constraint place_overrides_address_len
    check (address is null or char_length(btrim(address)) between 3 and 240),
  constraint place_overrides_category_len
    check (category is null or char_length(btrim(category)) between 2 and 80),
  constraint place_overrides_note_len
    check (admin_note is null or char_length(admin_note) <= 1000)
);

create index if not exists place_overrides_hidden_idx
  on public.place_overrides (hidden)
  where hidden = true;

alter table public.place_overrides enable row level security;

revoke all on table public.place_overrides from anon, authenticated, public;
-- Veřejný čtení jen sloupců, které jdou do katalogu (bez admin_note přes view).
grant select on table public.place_overrides to anon, authenticated;
grant select, insert, update, delete on table public.place_overrides to authenticated;

drop policy if exists place_overrides_public_select on public.place_overrides;
create policy place_overrides_public_select
  on public.place_overrides
  for select
  to anon, authenticated
  using (true);

drop policy if exists place_overrides_admin_insert on public.place_overrides;
create policy place_overrides_admin_insert
  on public.place_overrides
  for insert
  to authenticated
  with check (public.is_cheapeats_admin());

drop policy if exists place_overrides_admin_update on public.place_overrides;
create policy place_overrides_admin_update
  on public.place_overrides
  for update
  to authenticated
  using (public.is_cheapeats_admin())
  with check (public.is_cheapeats_admin());

drop policy if exists place_overrides_admin_delete on public.place_overrides;
create policy place_overrides_admin_delete
  on public.place_overrides
  for delete
  to authenticated
  using (public.is_cheapeats_admin());

-- Veřejné view bez interní poznámky.
create or replace view public.place_overrides_public
with (security_invoker = true)
as
select place_id, hidden, name, address, category, updated_at
from public.place_overrides;

revoke all on public.place_overrides_public from public;
grant select on public.place_overrides_public to anon, authenticated;
