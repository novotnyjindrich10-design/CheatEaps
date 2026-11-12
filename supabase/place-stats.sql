-- BLOCKED: nenasazovat bez výslovného souhlasu vlastníka.
-- Agregované statistiky profilu (bez přesné polohy uživatele).
-- Předpoklad: public.profiles + public.is_cheapeats_admin() (bootstrap-all).

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'place-stats.sql: nejdřív spusť supabase/bootstrap-all.sql (profiles).';
  end if;
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_cheapeats_admin'
  ) then
    raise exception 'place-stats.sql: chybí public.is_cheapeats_admin().';
  end if;
end $$;

create table if not exists public.place_stats_daily (
  restaurant_id text not null,
  day date not null,
  profile_views int not null default 0,
  route_clicks int not null default 0,
  website_clicks int not null default 0,
  phone_clicks int not null default 0,
  primary key (restaurant_id, day),
  constraint place_stats_restaurant_id_format
    check (restaurant_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  constraint place_stats_nonneg
    check (
      profile_views >= 0
      and route_clicks >= 0
      and website_clicks >= 0
      and phone_clicks >= 0
    )
);

create index if not exists place_stats_daily_day_idx
  on public.place_stats_daily (day desc);

alter table public.place_stats_daily enable row level security;

revoke all on table public.place_stats_daily from anon, authenticated, public;
grant select on table public.place_stats_daily to authenticated;

drop policy if exists place_stats_admin_select on public.place_stats_daily;
create policy place_stats_admin_select
  on public.place_stats_daily
  for select
  to authenticated
  using (public.is_cheapeats_admin());

-- Zápis jen přes RPC. directions_click i legacy route_click → route_clicks.
create or replace function public.record_place_stat(
  p_restaurant_id text,
  p_event text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rid text := btrim(coalesce(p_restaurant_id, ''));
  ev text := btrim(coalesce(p_event, ''));
  col text;
begin
  if rid = '' or rid !~ '^[a-z0-9][a-z0-9-]{0,119}$' then
    return false;
  end if;
  if ev = 'profile_view' then
    col := 'profile_views';
  elsif ev in ('route_click', 'directions_click') then
    col := 'route_clicks';
  elsif ev = 'website_click' then
    col := 'website_clicks';
  elsif ev = 'phone_click' then
    col := 'phone_clicks';
  else
    return false;
  end if;

  insert into public.place_stats_daily (restaurant_id, day)
  values (rid, (timezone('Europe/Prague', now()))::date)
  on conflict (restaurant_id, day) do nothing;

  if col = 'profile_views' then
    update public.place_stats_daily
    set profile_views = profile_views + 1
    where restaurant_id = rid and day = (timezone('Europe/Prague', now()))::date;
  elsif col = 'route_clicks' then
    update public.place_stats_daily
    set route_clicks = route_clicks + 1
    where restaurant_id = rid and day = (timezone('Europe/Prague', now()))::date;
  elsif col = 'website_clicks' then
    update public.place_stats_daily
    set website_clicks = website_clicks + 1
    where restaurant_id = rid and day = (timezone('Europe/Prague', now()))::date;
  else
    update public.place_stats_daily
    set phone_clicks = phone_clicks + 1
    where restaurant_id = rid and day = (timezone('Europe/Prague', now()))::date;
  end if;

  return true;
end;
$$;

revoke all on function public.record_place_stat(text, text) from public;
grant execute on function public.record_place_stat(text, text) to anon, authenticated;
