-- HomeOS – oprávnění členů podle sekcí, telefon a fotka člena, IČO, cenová paměť, push oznámení

-- Členové: telefon a profilová fotka
alter table public.members
  add column phone text check (phone is null or char_length(phone) <= 30),
  add column avatar_document_id uuid,
  add constraint members_avatar_fk foreign key (household_id, avatar_document_id)
    references public.documents (household_id, id) on delete set null (avatar_document_id);

-- Oprávnění připojených členů: { "sekce": "edit" | "view" }. Chybějící klíč = edit (plná práva).
alter table public.household_users add column permissions jsonb not null default '{}'::jsonb;

create or replace function public.has_household_perm(hid uuid, section text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_users
    where household_id = hid and user_id = auth.uid()
      and (role = 'owner' or coalesce(permissions ->> section, 'edit') = 'edit')
  );
$$;
revoke all on function public.has_household_perm(uuid, text) from public, anon;
grant execute on function public.has_household_perm(uuid, text) to authenticated;

-- Dokumenty smí přidávat každý, kdo může upravovat aspoň jednu sekci (účtenky, faktury, fotky nákupů)
create or replace function public.has_any_household_edit(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_users hu
    where hu.household_id = hid and hu.user_id = auth.uid()
      and (hu.role = 'owner' or exists (
        select 1 from unnest(array['finance', 'invoices', 'work', 'purchases', 'savings', 'settings']) as s(section)
        where coalesce(hu.permissions ->> s.section, 'edit') = 'edit'))
  );
$$;
revoke all on function public.has_any_household_edit(uuid) from public, anon;
grant execute on function public.has_any_household_edit(uuid) to authenticated;

-- vlastník mění oprávnění členů
create policy hu_update_owner on public.household_users for update to authenticated
  using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));

-- Nákupní seznam: obchod; cenová paměť
alter table public.shopping_items add column store text check (store is null or char_length(store) <= 40);

create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_key text not null check (char_length(item_key) between 1 and 120),
  name text not null check (char_length(name) between 1 and 120),
  quantity text check (quantity is null or char_length(quantity) <= 30),
  store text check (store is null or char_length(store) <= 40),
  price bigint not null check (price > 0),
  date date not null default current_date,
  created_at timestamptz not null default now()
);
create index on public.price_history (household_id, item_key);
alter table public.price_history enable row level security;

-- Push oznámení (týdenní souhrn) – odběry patří uživateli
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  endpoint text not null unique check (endpoint ~* '^https://'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_household_member(household_id));
revoke all on public.price_history, public.push_subscriptions from anon;

-- IČO: aktivace a omezení změny na 1× za 30 dní (pojistka i v databázi)
alter table public.household_settings
  add column ico_activated_at timestamptz,
  add column ico_changed_at timestamptz,
  add column ico_info jsonb;

create or replace function public.guard_ico_change() returns trigger
language plpgsql as $$
begin
  if new.billing_ico is distinct from old.billing_ico
     and old.billing_ico is not null
     and old.ico_changed_at is not null
     and old.ico_changed_at > now() - interval '30 days' then
    raise exception 'IČO lze měnit nejvýše jednou za 30 dní' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger household_settings_ico_guard before update on public.household_settings
  for each row execute function public.guard_ico_change();

-- Přepis politik: čtení všichni členové, zápis jen s oprávněním k sekci
do $$
declare
  r record;
begin
  for r in select * from (values
    ('transactions', 'finance'), ('accounts', 'finance'), ('categories', 'finance'), ('recurring_payments', 'finance'),
    ('income_sources', 'finance'), ('occurrence_marks', 'finance'), ('budgets', 'finance'),
    ('invoices', 'invoices'),
    ('work_shifts', 'work'), ('payouts', 'work'), ('work_settings', 'work'),
    ('purchases', 'purchases'), ('shopping_lists', 'purchases'), ('shopping_items', 'purchases'), ('price_history', 'purchases'),
    ('savings_goals', 'savings'), ('savings_contributions', 'savings'),
    ('household_settings', 'settings'), ('members', 'settings'),
    ('documents', '*')
  ) as t(tbl, section) loop
    execute format('drop policy if exists %I on public.%I', r.tbl || '_member', r.tbl);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))', r.tbl || '_select', r.tbl);
    if r.section = '*' then
      execute format('create policy %I on public.%I for insert to authenticated with check (public.has_any_household_edit(household_id))', r.tbl || '_insert', r.tbl);
      execute format('create policy %I on public.%I for update to authenticated using (public.has_any_household_edit(household_id)) with check (public.has_any_household_edit(household_id))', r.tbl || '_update', r.tbl);
      execute format('create policy %I on public.%I for delete to authenticated using (public.has_any_household_edit(household_id))', r.tbl || '_delete', r.tbl);
    else
      execute format('create policy %I on public.%I for insert to authenticated with check (public.has_household_perm(household_id, %L))', r.tbl || '_insert', r.tbl, r.section);
      execute format('create policy %I on public.%I for update to authenticated using (public.has_household_perm(household_id, %L)) with check (public.has_household_perm(household_id, %L))', r.tbl || '_update', r.tbl, r.section, r.section);
      execute format('create policy %I on public.%I for delete to authenticated using (public.has_household_perm(household_id, %L))', r.tbl || '_delete', r.tbl, r.section);
    end if;
  end loop;
end $$;

-- Přijetí pozvánky rovnou založí člena (s vazbou na účet), aby ho vlastník hned viděl
drop function if exists public.accept_household_invite(text);
create or replace function public.accept_household_invite(invite_code text, member_name text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv public.household_invites;
begin
  if auth.uid() is null then raise exception 'Nepřihlášený uživatel'; end if;
  select * into inv from public.household_invites
    where upper(code) = upper(invite_code) and used_by is null and expires_at > now()
    for update;
  if not found then raise exception 'Pozvánka neexistuje nebo vypršela'; end if;
  insert into public.household_users (household_id, user_id, role)
    values (inv.household_id, auth.uid(), 'member')
    on conflict (household_id, user_id) do nothing;
  update public.household_invites set used_by = auth.uid() where id = inv.id;
  perform public.ensure_own_member(inv.household_id, member_name);
  return inv.household_id;
end $$;

-- Každý uživatel s přístupem má v domácnosti svého člena (samooprava pro starší připojení)
create or replace function public.ensure_own_member(hid uuid, member_name text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  mid uuid;
  n int;
  colors text[] := array['#d4b483', '#9ccc65', '#7fb3d5', '#f48fb1', '#ffab91', '#ce93d8'];
  uemail text;
begin
  if not public.is_household_member(hid) then raise exception 'Nejste členem domácnosti'; end if;
  select id into mid from public.members where household_id = hid and user_id = auth.uid();
  if mid is not null then return mid; end if;
  select count(*) into n from public.members where household_id = hid;
  select email into uemail from auth.users where id = auth.uid();
  insert into public.members (household_id, name, color, user_id, is_active, sort)
    values (hid, coalesce(nullif(trim(member_name), ''), split_part(uemail, '@', 1), 'Nový člen'), colors[(n % 6) + 1], auth.uid(), true, n)
    returning id into mid;
  return mid;
end $$;
revoke all on function public.ensure_own_member(uuid, text) from public, anon;
grant execute on function public.ensure_own_member(uuid, text) to authenticated;
revoke all on function public.accept_household_invite(text, text) from public, anon;
grant execute on function public.accept_household_invite(text, text) to authenticated;
