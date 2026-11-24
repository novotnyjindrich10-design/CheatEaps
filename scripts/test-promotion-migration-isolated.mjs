/**
 * Skutečný integrační test promotion-apply-missing.sql na izolovaném Postgres v Dockeru.
 * Nespouští produkční Supabase. Exit 0 = OK.
 *
 * Spuštění: node scripts/test-promotion-migration-isolated.mjs
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const NAME = 'foodgo-promo-pg-test'
const IMAGE = 'postgres:16-alpine'
const DB = {
  user: 'postgres',
  password: 'postgres',
  db: 'postgres',
  port: '55432',
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: false,
    ...opts,
  })
  return result
}

function mustOk(result, label) {
  if (result.status !== 0) {
    console.error(label, result.stderr || result.stdout)
    process.exit(result.status || 1)
  }
}

function dockerReady() {
  const info = run('docker', ['info'])
  return info.status === 0
}

function waitPg() {
  for (let i = 0; i < 40; i += 1) {
    const probe = run('docker', [
      'exec',
      NAME,
      'pg_isready',
      '-U',
      DB.user,
      '-d',
      DB.db,
    ])
    if (probe.status === 0) return true
    spawnSync('docker', ['exec', NAME, 'sleep', '0.5'], { encoding: 'utf8' })
  }
  return false
}

function psqlFile(relOrAbs) {
  const abs = resolve(ROOT, relOrAbs)
  const result = run('docker', [
    'exec',
    '-i',
    NAME,
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    DB.user,
    '-d',
    DB.db,
    '-f',
    '-',
  ], {
    input: readFileSync(abs, 'utf8'),
  })
  return result
}

function psqlSql(sql) {
  return run('docker', [
    'exec',
    '-i',
    NAME,
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    DB.user,
    '-d',
    DB.db,
    '-f',
    '-',
  ], { input: sql })
}

if (!dockerReady()) {
  console.log(JSON.stringify({
    ok: false,
    isolatedDb: 'docker-unavailable',
    note: 'Docker daemon neběží — integrační test přeskočen.',
  }, null, 2))
  process.exit(2)
}

run('docker', ['rm', '-f', NAME])
const start = run('docker', [
  'run',
  '-d',
  '--name',
  NAME,
  '-e',
  `POSTGRES_PASSWORD=${DB.password}`,
  '-p',
  `${DB.port}:5432`,
  IMAGE,
])
mustOk(start, 'docker run')

if (!waitPg()) {
  console.error('Postgres v kontejneru nenaběhl')
  run('docker', ['rm', '-f', NAME])
  process.exit(1)
}

const steps = []
try {
  let r = psqlFile('scripts/isolated-promotion-fixture.sql')
  mustOk(r, 'fixture')
  steps.push('fixture')

  // Simuluj existující tabulky bez RPC (stav produkce před gap-fill).
  r = psqlSql(`
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
    create table if not exists public.promotion_payment_events (
      event_id text primary key,
      reference text not null,
      status text not null,
      received_at timestamptz not null default now()
    );
    create or replace view public.promotion_sponsorships_public as
      select place_id, plan_id, starts_at, ends_at from public.promotion_orders where false;
  `)
  mustOk(r, 'preexisting-tables')
  steps.push('preexisting-tables')

  r = psqlFile('supabase/promotion-apply-missing.sql')
  mustOk(r, 'apply-missing-1')
  steps.push('apply-missing-1')

  r = psqlFile('scripts/isolated-promotion-assertions.sql')
  mustOk(r, 'assertions')
  steps.push('assertions')

  // Zachování dat při 2. běhu
  r = psqlSql(`select count(*)::text as c from public.promotion_orders where reference = 'CETEST1';`)
  mustOk(r, 'count-before-rerun')
  const before = String(r.stdout || '')
  r = psqlFile('supabase/promotion-apply-missing.sql')
  mustOk(r, 'apply-missing-2')
  steps.push('apply-missing-2-idempotent')
  r = psqlSql(`
    do $$
    declare c int;
    begin
      select count(*) into c from public.promotion_orders where reference = 'CETEST1';
      if c <> 1 then raise exception 'data lost on rerun: %', c; end if;
      if (select status from public.promotion_orders where reference = 'CETEST1') <> 'active' then
        raise exception 'active status lost on rerun';
      end if;
    end $$;
  `)
  mustOk(r, 'data-preserved')
  steps.push('data-preserved')

  console.log(JSON.stringify({
    ok: true,
    isolatedDb: 'docker-postgres-16',
    container: NAME,
    steps,
    note: 'Skutečný integrační test na izolovaném Postgres. Produkční Supabase nedotčen.',
    countProbe: before.trim().slice(0, 80),
  }, null, 2))
} catch (error) {
  console.error(error)
  process.exit(1)
} finally {
  run('docker', ['rm', '-f', NAME])
}
