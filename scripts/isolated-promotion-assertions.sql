-- Assertion suite for isolated promotion migration. Raises on failure.

do $$
declare
  admin_id uuid := '11111111-1111-1111-1111-111111111111';
  user_id uuid := '22222222-2222-2222-2222-222222222222';
  submit jsonb;
  readback jsonb;
  pay jsonb;
  denied jsonb;
  ref text := 'CETEST1';
  access_key text := 'test-access-key-abcdefghijklmnopqrstuvwxyz';
  access_hash text;
  order_id uuid;
  cnt int;
  st text;
  pay_st text;
begin
  insert into auth.users (id, email) values (admin_id, 'admin@example.com')
  on conflict (id) do nothing;
  insert into auth.users (id, email) values (user_id, 'user@example.com')
  on conflict (id) do nothing;
  insert into public.profiles (id, email, is_admin) values (admin_id, 'admin@example.com', true)
  on conflict (id) do update set is_admin = excluded.is_admin;
  insert into public.profiles (id, email, is_admin) values (user_id, 'user@example.com', false)
  on conflict (id) do update set is_admin = excluded.is_admin;

  access_hash := encode(extensions.digest(convert_to(access_key, 'UTF8'), 'sha256'), 'hex');

  submit := public.submit_promotion_inquiry(
    jsonb_build_object(
      'termsAck', 'true',
      'planId', 'start',
      'periodId', 'mesicne',
      'planName', 'Start',
      'serviceLabel', '30 dní',
      'businessName', 'Izolovaná Pizza',
      'companyName', 'Izolovaná s.r.o.',
      'contactName', 'Jan Test',
      'email', 'pizza@example.com',
      'phone', '+420777123456',
      'billingAddress', 'Ulice 1, Brno',
      'placeId', 'izolovana-pizza',
      'vatStatus', 'non-payer',
      'description', '',
      'extra', '',
      'website', '',
      'ico', '',
      'dic', '',
      'vatNote', ''
    ),
    access_hash,
    ref
  );
  if coalesce(submit->>'ok', '') <> 'true' then
    raise exception 'submit failed: %', submit;
  end if;
  order_id := (submit->>'id')::uuid;

  readback := public.read_promotion_inquiry(ref, access_key);
  if coalesce(readback->>'ok', '') <> 'true' then
    raise exception 'read failed: %', readback;
  end if;
  if coalesce(readback->'order'->>'status', '') <> 'inquiry' then
    raise exception 'expected inquiry status';
  end if;
  if coalesce(readback->'order'->>'activated', 'true') = 'true' then
    raise exception 'inquiry must not be activated';
  end if;

  denied := public.submit_promotion_inquiry(
    jsonb_build_object(
      'termsAck', 'true',
      'planId', 'start',
      'periodId', 'mesicne',
      'planName', 'Start',
      'serviceLabel', '30 dní',
      'businessName', 'Izolovaná Pizza',
      'companyName', 'Izolovaná s.r.o.',
      'contactName', 'Jan Test',
      'email', 'pizza@example.com',
      'phone', '+420777123456',
      'billingAddress', 'Ulice 1, Brno',
      'placeId', 'izolovana-pizza',
      'vatStatus', 'non-payer'
    ),
    access_hash,
    'CETEST2'
  );
  if coalesce(denied->>'error', '') <> 'duplicate' then
    raise exception 'expected duplicate, got %', denied;
  end if;

  -- Non-admin via RLS: update matches 0 rows (policy admin-only).
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  execute 'set local role authenticated';
  update public.promotion_orders
    set status = 'active',
        payment_status = 'paid',
        place_id = 'izolovana-pizza',
        starts_at = now(),
        ends_at = now() + interval '30 days'
    where id = order_id;
  execute 'reset role';
  select status into st from public.promotion_orders where id = order_id;
  if st <> 'inquiry' then
    raise exception 'RLS allowed non-admin activation';
  end if;

  -- Bypass RLS but without admin/hook: trigger must block paid flip.
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    update public.promotion_orders
      set payment_status = 'paid'
      where id = order_id;
    raise exception 'paid without admin/hook should fail';
  exception
    when others then
      if sqlerrm not like '%payment-requires-admin-or-webhook%' and sqlstate <> '42501' then
        raise;
      end if;
  end;

  pay := public.record_verified_payment('evt-1', ref, 'paid', 'wrong-secret');
  if coalesce(pay->>'error', '') <> 'forbidden' then
    raise exception 'expected forbidden payment, got %', pay;
  end if;

  perform set_config('app.payment_webhook_secret', 'isolated-test-secret-16', false);
  pay := public.record_verified_payment('evt-paid-1', ref, 'paid', 'isolated-test-secret-16');
  if coalesce(pay->>'ok', '') <> 'true' then
    raise exception 'paid record failed: %', pay;
  end if;
  if coalesce(pay->>'activated', 'true') = 'true' then
    raise exception 'RPC must not activate';
  end if;

  select status, payment_status into st, pay_st from public.promotion_orders where id = order_id;
  if pay_st <> 'paid' then
    raise exception 'payment_status not paid';
  end if;
  if st <> 'inquiry' then
    raise exception 'status must stay inquiry after payment RPC';
  end if;

  pay := public.record_verified_payment('evt-paid-1', ref, 'paid', 'isolated-test-secret-16');
  if coalesce(pay->>'duplicate', 'false') <> 'true' then
    raise exception 'expected duplicate webhook %', pay;
  end if;

  -- Authorized admin activation (server payments.js activateAfterPaid equivalent)
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.promotion_orders
    set status = 'active',
        place_id = 'izolovana-pizza',
        starts_at = now(),
        ends_at = now() + interval '30 days',
        activated_at = now()
    where id = order_id
      and payment_status = 'paid';
  select status into st from public.promotion_orders where id = order_id;
  if st <> 'active' then
    raise exception 'admin activation failed';
  end if;

  select count(*) into cnt from public.promotion_orders where reference = ref;
  if cnt <> 1 then
    raise exception 'order missing after activation';
  end if;

  if has_function_privilege('anon', 'public.submit_promotion_inquiry(jsonb,text,text)', 'execute') is not true then
    raise exception 'anon missing submit execute';
  end if;
  if has_function_privilege('anon', 'public.record_verified_payment(text,text,text,text)', 'execute') then
    raise exception 'anon must not execute record_verified_payment';
  end if;
  if has_function_privilege('service_role', 'public.record_verified_payment(text,text,text,text)', 'execute') is not true then
    raise exception 'service_role missing payment execute';
  end if;

  if to_regclass('public.place_owner_claims') is null or to_regclass('public.promotion_audit_log') is null then
    raise exception 'owners tables missing';
  end if;

  raise notice 'ISOLATED_PROMOTION_ASSERTIONS_OK';
end $$;
