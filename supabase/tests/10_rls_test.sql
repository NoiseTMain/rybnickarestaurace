-- Testy bezpečnostních pravidel a logiky zveřejnění / odesílání menu.
-- Každý blok končí výjimkou, pokud ověření selže (psql -v ON_ERROR_STOP=1).

\set admin_id   '''11111111-1111-1111-1111-111111111111'''
\set visitor_id '''22222222-2222-2222-2222-222222222222'''

insert into auth.users (id, email) values
  (:admin_id, 'majitel@example.cz'),
  (:visitor_id, 'host@example.cz');
insert into public.admin_users (user_id) values (:admin_id);

-- pomocné funkce pro přepínání identity
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $$;
create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;

-- ---------------------------------------------------------------------
\echo '1) Výchozí obsah je založen'
do $$ begin
  assert (select count(*) from public.site_settings) = 1, 'chybí site_settings';
  assert (select phone from public.site_settings) = '+420 602 163 330', 'špatný telefon';
  assert (select menu_email_recipient from public.private_settings) = 'info@rybnickarestaurace.cz', 'špatný příjemce';
  assert (select count(*) from public.spaces) = 5, 'chybí prostory';
  assert (select count(*) from public.spaces where capacity is not null) = 0, 'kapacity nesmí být vymyšlené';
end $$;

-- ---------------------------------------------------------------------
\echo '2) Anonymní návštěvník nesmí zapisovat'
select pg_temp.as_anon();
do $$
declare ok boolean;
begin
  begin
    insert into public.daily_menus (menu_date, storage_path, original_filename, file_size)
    values (current_date, '2026/10/x.png', 'x.png', 10);
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'anon vložil menu';

  begin
    update public.site_settings set phone = 'hack';
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'anon změnil nastavení';

  begin
    perform public.publish_menu(gen_random_uuid());
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'anon spustil publish_menu';

  -- neveřejná nastavení nejsou vidět
  assert (select count(*) from public.private_settings) = 0, 'anon vidí private_settings';
  assert (select count(*) from public.inquiries) = 0, 'anon vidí poptávky';
  -- veřejné nastavení vidí
  assert (select count(*) from public.site_settings) = 1, 'anon nevidí site_settings';
end $$;

-- storage: anonym nesmí nahrát do bucketu menus
do $$
declare ok boolean;
begin
  begin
    insert into storage.objects (bucket_id, name) values ('menus', '2026/10/hack.png');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'anon nahrál soubor';
end $$;
reset role;

-- ---------------------------------------------------------------------
\echo '3) Přihlášený uživatel bez role admin nesmí nic měnit'
select pg_temp.as_user(:visitor_id);
do $$
declare ok boolean; n int;
begin
  begin
    insert into public.daily_menus (menu_date, storage_path, original_filename, file_size)
    values (current_date, '2026/10/y.png', 'y.png', 10);
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'ne-admin vložil menu';

  update public.site_settings set phone = 'hack';
  get diagnostics n = row_count;
  assert n = 0, 'ne-admin změnil nastavení';

  begin
    perform public.claim_menu_email(gen_random_uuid(), false);
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'ne-admin zamkl e-mail';

  begin
    insert into storage.objects (bucket_id, name) values ('menus', '2026/10/hack.png');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'ne-admin nahrál soubor';

  insert into public.admin_users (user_id) values (auth.uid());
  ok := false;
exception
  when insufficient_privilege then null; -- očekáváno: nelze se povýšit na admina
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.admin_users) = 1, 'ne-admin se povýšil na admina';
end $$;

-- ---------------------------------------------------------------------
\echo '4) Admin nahraje a zveřejní menu, historie zůstává'
select pg_temp.as_user(:admin_id);
do $$
declare m1 uuid; m2 uuid; r public.daily_menus;
begin
  insert into storage.objects (bucket_id, name) values ('menus', '2026/10/2026-10-15_a.png');
  insert into storage.objects (bucket_id, name) values ('menus', '2026/10/2026-10-16_b.png');

  insert into public.daily_menus (menu_date, storage_path, original_filename, file_size, width, height)
  values ('2026-10-15', '2026/10/2026-10-15_a.png', 'menu-ctvrtek.png', 1000, 1240, 1754)
  returning id into m1;
  r := public.publish_menu(m1);
  assert r.is_current and r.publish_count = 1, 'první zveřejnění selhalo';

  insert into public.daily_menus (menu_date, storage_path, original_filename, file_size, width, height)
  values ('2026-10-16', '2026/10/2026-10-16_b.png', 'menu-patek.png', 2000, 1240, 1754)
  returning id into m2;
  r := public.publish_menu(m2);

  assert (select count(*) from public.daily_menus) = 2, 'historie se ztratila';
  assert (select count(*) from public.daily_menus where is_current) = 1, 'více aktuálních menu';
  assert (select id from public.daily_menus where is_current) = m2, 'nové menu není aktuální';
  assert (select published_at is not null from public.daily_menus where id = m1), 'starší menu ztratilo datum zveřejnění';

  -- znovuzveřejnění staršího menu
  r := public.publish_menu(m1);
  assert (select id from public.daily_menus where is_current) = m1, 'znovuzveřejnění selhalo';
  assert r.publish_count = 2, 'počítadlo zveřejnění';
  assert r.first_published_at <= r.published_at, 'first_published_at';
  r := public.publish_menu(m2);

  -- nelze vložit menu rovnou jako aktuální (obejití publish_menu)
  begin
    insert into public.daily_menus (menu_date, storage_path, original_filename, file_size, is_current, published_at)
    values ('2026-10-17', '2026/10/c.png', 'c.png', 10, true, now());
    raise exception 'vloženo aktuální menu';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------
\echo '5) Zámek e-mailu brání dvojímu odeslání'
do $$
declare m uuid; n int;
begin
  select id into m from public.daily_menus where is_current;

  select count(*) into n from public.claim_menu_email(m, false);
  assert n = 1, 'první zámek se nezískal';
  select count(*) into n from public.claim_menu_email(m, false);
  assert n = 0, 'druhý souběžný zámek prošel';

  update public.daily_menus set email_status = 'sent', email_sent_at = now() where id = m;
  select count(*) into n from public.claim_menu_email(m, false);
  assert n = 0, 'odeslané menu se odeslalo znovu bez potvrzení';
  select count(*) into n from public.claim_menu_email(m, true);
  assert n = 1, 'vědomé znovuodeslání nefunguje';

  update public.daily_menus set email_status = 'failed' where id = m;
  select count(*) into n from public.claim_menu_email(m, false);
  assert n = 1, 'po chybě nelze opakovat';

  -- zaseknutý stav "sending" se po 5 minutách uvolní
  update public.daily_menus set email_claimed_at = now() - interval '6 minutes' where id = m;
  select count(*) into n from public.claim_menu_email(m, false);
  assert n = 1, 'zaseknutý zámek se neuvolnil';
  assert (select email_attempts from public.daily_menus where id = m) = 4, 'počet pokusů';
end $$;
reset role;

-- ---------------------------------------------------------------------
\echo '6) Veřejnost vidí jen aktuální menu'
select pg_temp.as_anon();
do $$ begin
  assert (select count(*) from public.daily_menus) = 1, 'anon vidí historii menu';
  assert (select menu_date from public.daily_menus) = '2026-10-16', 'anon vidí špatné menu';
end $$;
do $$
declare n int;
begin
  delete from public.daily_menus;
  get diagnostics n = row_count;
  assert n = 0, 'anon smazal menu';
exception when insufficient_privilege then null;
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.daily_menus) = 2, 'menu bylo smazáno';
end $$;

-- ---------------------------------------------------------------------
\echo '7) Skryté položky lístku nejsou veřejné'
select pg_temp.as_user(:admin_id);
do $$
declare c uuid;
begin
  select id into c from public.menu_categories where name = 'Pivo';
  insert into public.menu_items (category_id, name, price, is_visible) values (c, 'Viditelné', 50, true);
  insert into public.menu_items (category_id, name, price, is_visible) values (c, 'Skryté', 50, false);
end $$;
reset role;
select pg_temp.as_anon();
do $$ begin
  assert (select count(*) from public.menu_items) = 1, 'anon vidí skryté položky';
end $$;
reset role;

-- ---------------------------------------------------------------------
\echo '8) Admin smí mazat menu po potvrzení (aplikace), ostatní ne'
select pg_temp.as_user(:visitor_id);
do $$
declare n int;
begin
  delete from public.daily_menus;
  get diagnostics n = row_count;
  assert n = 0, 'ne-admin smazal menu';
end $$;
reset role;
select pg_temp.as_user(:admin_id);
do $$
declare n int;
begin
  delete from public.daily_menus where not is_current;
  get diagnostics n = row_count;
  assert n = 1, 'admin nemůže mazat';
  assert (select count(*) from public.daily_menus where is_current) = 1, 'smazáno aktuální menu';
end $$;
reset role;

\echo 'VŠECHNY DATABÁZOVÉ TESTY PROŠLY'
