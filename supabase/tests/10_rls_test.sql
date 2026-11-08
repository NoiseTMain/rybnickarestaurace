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

\echo '8) Nákupní seznam a odebrání člena vlastníkem'
select pg_temp.as_user(:alice);
insert into public.shopping_lists (id, household_id, name) values ('55555555-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Víkend');
insert into public.shopping_items (household_id, list_id, name, est_price) values ('11111111-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'Mléko', 2490);
insert into public.transactions (household_id, type, amount, date, account_id, description, shopping_list_id, source)
  values ('11111111-0000-0000-0000-000000000001', 'expense', 2490, '2026-11-07', '22222222-0000-0000-0000-000000000001', 'Nákup', '55555555-0000-0000-0000-000000000001', 'shopping');
do $$
declare ok boolean;
begin
  begin
    insert into public.transactions (household_id, type, amount, date, account_id, description, shopping_list_id, source)
      values ('11111111-0000-0000-0000-000000000001', 'expense', 2490, '2026-11-07', '22222222-0000-0000-0000-000000000001', 'Znovu', '55555555-0000-0000-0000-000000000001', 'shopping');
    ok := false;
  exception when unique_violation then ok := true;
  end;
  assert ok, 'nákupní seznam zapsán jako výdaj dvakrát';
end $$;
delete from public.household_users where household_id = '11111111-0000-0000-0000-000000000001' and user_id = :bob;
reset role;
select pg_temp.as_user(:bob);
do $$ begin
  assert (select count(*) from public.transactions where household_id = '11111111-0000-0000-0000-000000000001') = 0, 'odebraný člen stále vidí data';
  assert (select count(*) from public.shopping_items) = 0, 'odebraný člen vidí nákupní seznam';
end $$;
reset role;

\echo '9) Oprávnění člena podle sekcí'
select pg_temp.as_user(:alice);
insert into public.household_invites (household_id, code) values ('11111111-0000-0000-0000-000000000001', 'POZVANKA-ABCDEFG');
reset role;
select pg_temp.as_user(:bob);
select public.accept_household_invite('pozvanka-abcdefg', 'Bob');
do $$ begin
  assert (select count(*) from public.members where household_id = '11111111-0000-0000-0000-000000000001' and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 1, 'připojený člen nemá právě jeden řádek člena';
end $$;
-- výchozí plná práva
insert into public.transactions (household_id, type, amount, date, account_id, description)
  values ('11111111-0000-0000-0000-000000000001', 'expense', 100, '2026-11-08', '22222222-0000-0000-0000-000000000001', 'bob plná práva');
do $$
declare ok boolean;
begin
  begin
    update public.household_users set permissions = '{"finance":"edit","settings":"edit"}' where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and household_id = '11111111-0000-0000-0000-000000000001';
    ok := not found;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'člen si změnil oprávnění';
end $$;
reset role;
select pg_temp.as_user(:alice);
update public.household_users set permissions = '{"finance":"view","settings":"view"}' where user_id = :bob and household_id = '11111111-0000-0000-0000-000000000001';
reset role;
select pg_temp.as_user(:bob);
do $$
declare ok boolean;
begin
  assert (select count(*) from public.transactions where household_id = '11111111-0000-0000-0000-000000000001') > 0, 'člen jen pro čtení nevidí data';
  begin
    insert into public.transactions (household_id, type, amount, date, account_id, description)
      values ('11111111-0000-0000-0000-000000000001', 'expense', 100, '2026-11-08', '22222222-0000-0000-0000-000000000001', 'zakázáno');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'člen jen pro čtení zapsal transakci';
  update public.members set name = 'hack' where household_id = '11111111-0000-0000-0000-000000000001';
  -- sekce bez omezení zůstává upravitelná
  insert into public.shopping_lists (household_id, name) values ('11111111-0000-0000-0000-000000000001', 'Bobův seznam');
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.members where name = 'hack') = 0, 'člen jen pro čtení přejmenoval členy';
end $$;

\echo '10) IČO lze změnit nejvýše jednou za 30 dní'
select pg_temp.as_user(:alice);
insert into public.household_settings (household_id, billing_ico, ico_changed_at) values ('11111111-0000-0000-0000-000000000001', '27082440', now());
do $$
declare ok boolean;
begin
  begin
    update public.household_settings set billing_ico = '12345678' where household_id = '11111111-0000-0000-0000-000000000001';
    ok := false;
  exception when check_violation then ok := true;
  end;
  assert ok, 'IČO změněno dříve než po 30 dnech';
end $$;
reset role;

\echo '11) Cestování: oprávnění sekce a vazby'
select pg_temp.as_user(:alice);
insert into public.trips (id, household_id, name, destination, budget) values ('77777777-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Vídeň', 'Vídeň', 900000);
insert into public.trip_legs (household_id, trip_id, mode, carrier, from_place, to_place, price) values ('11111111-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'train', 'RegioJet', 'Praha', 'Vídeň', 79800);
insert into public.trip_expenses (household_id, trip_id, kind, description, amount, currency, amount_original, rate) values ('11111111-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'food', 'Řízek', 58464, 'EUR', 2320, 25.2);
update public.household_users set permissions = '{"travel":"view"}' where user_id = :bob and household_id = '11111111-0000-0000-0000-000000000001';
do $$
declare ok boolean;
begin
  begin
    insert into public.trips (household_id, name, destination) values ('11111111-0000-0000-0000-000000000001', 'x', 'y') ;
    ok := true;
  end;
  begin
    insert into public.trip_expenses (household_id, trip_id, kind, description, amount) values ('11111111-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'food', 'záporná', -5);
    ok := false;
  exception when check_violation then ok := true;
  end;
  assert ok, 'záporný výdaj na cestě prošel';
end $$;
reset role;
select pg_temp.as_user(:bob);
do $$
declare ok boolean;
begin
  assert (select count(*) from public.trip_legs where trip_id = '77777777-0000-0000-0000-000000000001') = 1, 'člen nevidí trasu';
  begin
    insert into public.trips (household_id, name, destination) values ('11111111-0000-0000-0000-000000000001', 'Bob', 'Řím');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'člen jen pro čtení založil cestu';
  update public.trip_expenses set amount = 1 where trip_id = '77777777-0000-0000-0000-000000000001';
end $$;
reset role;
do $$ begin
  assert (select amount from public.trip_expenses where description = 'Řízek') = 58464, 'člen jen pro čtení změnil výdaj na cestě';
end $$;
-- cizí domácnost nevidí cesty
select pg_temp.as_user('cccccccc-cccc-cccc-cccc-cccccccccccc');
do $$ begin
  assert (select count(*) from public.trips) = 0, 'cizí uživatel vidí cesty';
end $$;
reset role;

\echo '12) Cestování 2: účastníci, hotovost, seznam, program, upozornění'
select pg_temp.as_user(:alice);
insert into public.trip_people (id, household_id, trip_id, name) values ('77777777-0000-0000-0000-0000000000a1', '11111111-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'Alice');
insert into public.trip_cash_moves (household_id, trip_id, kind, currency, amount_original, amount, rate, date) values ('11111111-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'buy', 'EUR', 10000, 252000, 25.2, '2026-12-10');
insert into public.trip_checklist (household_id, trip_id, text) values ('11111111-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'Pas');
insert into public.trip_plan_items (household_id, trip_id, kind, title) values ('11111111-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'stay', 'Hotel');
update public.trip_expenses set paid_by = '77777777-0000-0000-0000-0000000000a1', split_among = array['77777777-0000-0000-0000-0000000000a1']::uuid[], from_cash = true where description = 'Řízek';
do $$
declare ok boolean;
begin
  begin
    insert into public.trip_cash_moves (household_id, trip_id, kind, currency, amount_original, amount, rate, date) values ('11111111-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'buy', 'CZK', 1, 1, 1, '2026-12-10');
    ok := false;
  exception when check_violation then ok := true;
  end;
  assert ok, 'hotovost v CZK prošla';
  begin
    insert into public.trip_notifications (household_id, trip_id, kind, date) values ('11111111-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'departure', '2026-12-09');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'uživatel zapsal záznam o upozornění (smí jen server)';
end $$;
reset role;
select pg_temp.as_user(:bob);
do $$
declare ok boolean;
begin
  assert (select count(*) from public.trip_people where trip_id = '77777777-0000-0000-0000-000000000001') = 1, 'člen nevidí účastníky';
  begin
    insert into public.trip_checklist (household_id, trip_id, text) values ('11111111-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'Bob');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'člen jen pro čtení přidal do seznamu';
end $$;
reset role;
select pg_temp.as_user('cccccccc-cccc-cccc-cccc-cccccccccccc');
do $$ begin
  assert (select count(*) from public.trip_cash_moves) + (select count(*) from public.trip_plan_items) + (select count(*) from public.trip_people) = 0, 'cizí uživatel vidí data cesty';
end $$;
reset role;
-- smazání účastníka vynuluje plátce
delete from public.trip_people where id = '77777777-0000-0000-0000-0000000000a1';
do $$ begin
  assert (select paid_by from public.trip_expenses where description = 'Řízek') is null, 'plátce nezůstal po smazání účastníka prázdný';
end $$;
