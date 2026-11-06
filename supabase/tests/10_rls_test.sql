-- Testy schématu a Row Level Security HomeOS.
\set alice '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''
\set bob   '''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'''

insert into auth.users (id, email) values (:alice, 'alice@example.cz'), (:bob, 'bob@example.cz');

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $$;

\echo '1) Alice založí domácnost a stane se vlastníkem'
select pg_temp.as_user(:alice);
insert into public.households (id, name) values ('11111111-0000-0000-0000-000000000001', 'Domácnost Alice');
insert into public.household_users (household_id, user_id, role) values ('11111111-0000-0000-0000-000000000001', :alice, 'owner') returning id;
insert into public.accounts (id, household_id, name, opening_balance, opening_date)
  values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Běžný účet', 1234567, '2026-11-01');
insert into public.categories (id, household_id, name, is_food) values ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Potraviny', true);
insert into public.transactions (household_id, type, amount, date, account_id, category_id, description)
  values ('11111111-0000-0000-0000-000000000001', 'expense', 45050, '2026-11-02', '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Nákup');
reset role;

\echo '2) Bob nevidí ani nemění data Alice'
select pg_temp.as_user(:bob);
do $$
declare ok boolean;
begin
  assert (select count(*) from public.households) = 0, 'Bob vidí cizí domácnost';
  assert (select count(*) from public.transactions) = 0, 'Bob vidí cizí transakce';
  assert (select count(*) from public.accounts) = 0, 'Bob vidí cizí účty';
  update public.accounts set opening_balance = 0;
  begin
    insert into public.transactions (household_id, type, amount, date, account_id, description)
      values ('11111111-0000-0000-0000-000000000001', 'expense', 100, '2026-11-02', '22222222-0000-0000-0000-000000000001', 'hack');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'Bob vložil transakci do cizí domácnosti';
  begin
    insert into public.household_users (household_id, user_id, role) values ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'Bob se přidal do cizí domácnosti';
end $$;
reset role;
do $$ begin
  assert (select opening_balance from public.accounts) = 1234567, 'Bob změnil cizí účet';
end $$;

\echo '3) Anonym nemá přístup'
select pg_temp.as_anon();
do $$
declare ok boolean;
begin
  begin
    perform count(*) from public.transactions;
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'anon čte transakce';
end $$;
reset role;

\echo '4) Ochrana proti dvojímu započtení a nesmyslným datům'
select pg_temp.as_user(:alice);
do $$
declare ok boolean;
begin
  insert into public.recurring_payments (id, household_id, name, amount, frequency, start_date)
    values ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Nájem', 1500000, 'monthly', '2026-11-05');
  insert into public.transactions (household_id, type, amount, date, account_id, description, recurring_payment_id, occurrence_date)
    values ('11111111-0000-0000-0000-000000000001', 'expense', 1500000, '2026-11-05', '22222222-0000-0000-0000-000000000001', 'Nájem', '44444444-0000-0000-0000-000000000001', '2026-11-05');
  begin
    insert into public.transactions (household_id, type, amount, date, account_id, description, recurring_payment_id, occurrence_date)
      values ('11111111-0000-0000-0000-000000000001', 'expense', 1500000, '2026-11-05', '22222222-0000-0000-0000-000000000001', 'Nájem znovu', '44444444-0000-0000-0000-000000000001', '2026-11-05');
    ok := false;
  exception when unique_violation then ok := true;
  end;
  assert ok, 'platba za stejný termín zapsána dvakrát';

  -- storno uvolní termín pro opravenou platbu
  update public.transactions set status = 'cancelled', cancelled_at = now() where recurring_payment_id is not null;
  insert into public.transactions (household_id, type, amount, date, account_id, description, recurring_payment_id, occurrence_date)
    values ('11111111-0000-0000-0000-000000000001', 'expense', 1500000, '2026-11-06', '22222222-0000-0000-0000-000000000001', 'Nájem opraveno', '44444444-0000-0000-0000-000000000001', '2026-11-05');

  begin
    insert into public.transactions (household_id, type, amount, date, account_id, description)
      values ('11111111-0000-0000-0000-000000000001', 'expense', -100, '2026-11-02', '22222222-0000-0000-0000-000000000001', 'záporná');
    ok := false;
  exception when check_violation then ok := true;
  end;
  assert ok, 'záporná částka prošla';

  begin
    insert into public.transactions (household_id, type, amount, date, account_id, external_id, description)
      values ('11111111-0000-0000-0000-000000000001', 'expense', 100, '2026-11-02', '22222222-0000-0000-0000-000000000001', 'csv-1', 'a');
    insert into public.transactions (household_id, type, amount, date, account_id, external_id, description)
      values ('11111111-0000-0000-0000-000000000001', 'expense', 100, '2026-11-02', '22222222-0000-0000-0000-000000000001', 'csv-1', 'a');
    ok := false;
  exception when unique_violation then ok := true;
  end;
  assert ok, 'opakovaný CSV import zapsal duplicitu';
end $$;
reset role;

\echo '5) Záznam nemůže odkazovat na účet jiné domácnosti'
select pg_temp.as_user(:bob);
insert into public.households (id, name) values ('11111111-0000-0000-0000-000000000002', 'Domácnost Boba');
insert into public.household_users (household_id, user_id, role) values ('11111111-0000-0000-0000-000000000002', :bob, 'owner') returning id;
do $$
declare ok boolean;
begin
  begin
    insert into public.transactions (household_id, type, amount, date, account_id, description)
      values ('11111111-0000-0000-0000-000000000002', 'expense', 100, '2026-11-02', '22222222-0000-0000-0000-000000000001', 'cizí účet');
    ok := false;
  exception when foreign_key_violation then ok := true;
  end;
  assert ok, 'transakce odkazuje na cizí účet';
  begin
    insert into public.documents (household_id, title, storage_path, file_name, mime_type, size_bytes)
      values ('11111111-0000-0000-0000-000000000002', 'x', '11111111-0000-0000-0000-000000000001/x.pdf', 'x.pdf', 'application/pdf', 1);
    ok := false;
  exception when check_violation then ok := true;
  end;
  assert ok, 'dokument ukazuje do cizí složky';
end $$;
reset role;

\echo '6) Pozvánka do domácnosti'
select pg_temp.as_user(:alice);
insert into public.household_invites (household_id, code) values ('11111111-0000-0000-0000-000000000001', 'POZVANKA-123456');
reset role;
select pg_temp.as_user(:bob);
select public.accept_household_invite('POZVANKA-123456');
do $$ begin
  assert (select count(*) from public.transactions where household_id = '11111111-0000-0000-0000-000000000001') > 0, 'Bob po přijetí pozvánky nevidí data';
end $$;
do $$
declare ok boolean;
begin
  begin
    perform public.accept_household_invite('POZVANKA-123456');
    ok := false;
  exception when others then ok := true;
  end;
  assert ok, 'pozvánka použita dvakrát';
end $$;
reset role;

\echo '7) Úložiště: jen vlastní složka'
select pg_temp.as_user(:alice);
insert into storage.objects (bucket_id, name) values ('documents', '11111111-0000-0000-0000-000000000001/a.pdf');
do $$
declare ok boolean;
begin
  begin
    insert into storage.objects (bucket_id, name) values ('documents', '11111111-0000-0000-0000-000000000002/a.pdf');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'Alice nahrála soubor do cizí složky';
end $$;
reset role;
