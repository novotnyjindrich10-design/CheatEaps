-- Syntetická data pro prázdný projekt foodgo-preview.
-- NESPUSŤ na produkčním projektu pcptzyfoojmnspumcmsi.
-- Žádní skuteční zákazníci, hesla, kontakty ani objednávky.

insert into auth.users (id, email)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'preview-user@example.com')
on conflict (id) do nothing;

insert into public.profiles (id, email, is_admin)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'preview-user@example.com', false)
on conflict (id) do nothing;

insert into public.promotion_orders (
  reference, access_hash, status, payment_status, renewal,
  plan_id, plan_name, period_id, amount, currency, service_days, service_label,
  vat_status, place_id, place_key, business_name, company_name,
  contact_name, email, phone, billing_address
)
select
  'CEPREVIEW1',
  repeat('ab', 32),
  'inquiry',
  'none',
  'none',
  'start',
  'Start',
  'mesicne',
  99,
  'CZK',
  30,
  '30 dní',
  'non-payer',
  'preview-bistro',
  'id:preview-bistro',
  'Preview Bistro',
  'Preview s.r.o.',
  'Test Preview',
  'preview-bistro@example.com',
  '+420700000001',
  'Testovací 1, Brno'
where not exists (
  select 1 from public.promotion_orders where reference = 'CEPREVIEW1'
);
