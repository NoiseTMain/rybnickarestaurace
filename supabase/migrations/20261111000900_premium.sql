-- HomeOS – Free / Premium: předplatné, administrace, limity vynucené v databázi

-- Předplatné uživatele (zapisuje jen server: webhook platební brány nebo administrátor)
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null check (status in ('active', 'on_trial', 'past_due', 'paused', 'cancelled', 'expired', 'unpaid', 'granted', 'revoked')),
  source text not null check (source in ('lemonsqueezy', 'admin')),
  variant text check (variant is null or variant in ('monthly', 'yearly', 'lifetime', 'manual')),
  provider_subscription_id text unique,
  provider_customer_id text,
  renews_at timestamptz,
  ends_at timestamptz,
  portal_url text,
  granted_by uuid references auth.users (id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy subscriptions_own on public.subscriptions for select to authenticated using (user_id = auth.uid());
revoke all on public.subscriptions from anon;
revoke insert, update, delete on public.subscriptions from authenticated;

-- Záznam akcí administrátora
create table public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 60),
  target_user_id uuid,
  target_email text,
  detail jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

-- Počet dotazů na AI za měsíc (kvůli nákladům)
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  count int not null default 0,
  primary key (user_id, month)
);
alter table public.ai_usage enable row level security;
create policy ai_usage_own on public.ai_usage for select to authenticated using (user_id = auth.uid());
revoke all on public.ai_usage from anon;
revoke insert, update, delete on public.ai_usage from authenticated;

create or replace function public.increment_ai_usage() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Nepřihlášený uživatel'; end if;
  insert into public.ai_usage (user_id, month, count) values (auth.uid(), to_char(now() at time zone 'Europe/Prague', 'YYYY-MM'), 1)
    on conflict (user_id, month) do update set count = public.ai_usage.count + 1
    returning count into n;
  return n;
end $$;
revoke all on function public.increment_ai_usage() from public, anon;
grant execute on function public.increment_ai_usage() to authenticated;

-- Je předplatné aktivní?
create or replace function public.subscription_active(s public.subscriptions) returns boolean
language sql immutable as $$
  select case
    when s.status in ('active', 'on_trial', 'past_due') then true
    when s.status = 'granted' then s.ends_at is null or s.ends_at > now()
    when s.status = 'cancelled' then s.ends_at is not null and s.ends_at > now()
    else false end
$$;

create or replace function public.user_is_premium(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subscriptions s where s.user_id = uid and public.subscription_active(s))
$$;

-- Domácnost má Premium, když ho má kterýkoli její člen s účtem (nebo jde o ukázkovou domácnost)
create or replace function public.household_is_premium(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.households h where h.id = hid and h.is_demo)
      or exists (select 1 from public.household_users hu join public.subscriptions s on s.user_id = hu.user_id
                 where hu.household_id = hid and public.subscription_active(s))
$$;
revoke all on function public.user_is_premium(uuid) from public, anon;
revoke all on function public.household_is_premium(uuid) from public, anon;
grant execute on function public.user_is_premium(uuid) to authenticated;
grant execute on function public.household_is_premium(uuid) to authenticated;

-- Cestování je Premium: zápis jen v domácnosti s Premium (čtení zůstává – data se po skončení neztratí)
do $$
declare t text;
begin
  foreach t in array array['trips', 'trip_legs', 'trip_expenses', 'trip_people', 'trip_cash_moves', 'trip_checklist', 'trip_plan_items'] loop
    execute format('drop policy %I on public.%I', t || '_insert', t);
    execute format('drop policy %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_household_perm(household_id, %L) and public.household_is_premium(household_id))', t || '_insert', t, 'travel');
    execute format('create policy %I on public.%I for update to authenticated using (public.has_household_perm(household_id, %L)) with check (public.has_household_perm(household_id, %L) and public.household_is_premium(household_id))', t || '_update', t, 'travel', 'travel');
  end loop;
end $$;

-- Upozornění na telefon jsou Premium
drop policy push_own on public.push_subscriptions;
create policy push_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
create policy push_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id) and public.household_is_premium(household_id));
create policy push_update on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.household_is_premium(household_id));

-- Zdarma: nejvýše 2 členové v domácnosti
create or replace function public.limit_free_members() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.household_is_premium(new.household_id)
     and (select count(*) from public.members where household_id = new.household_id) >= 2 then
    raise exception 'PREMIUM: Verze zdarma umožňuje nejvýše 2 členy domácnosti. Pro další členy aktivujte Premium.';
  end if;
  return new;
end $$;
create trigger members_free_limit before insert on public.members for each row execute function public.limit_free_members();

-- Zdarma: nejvýše 1 vlastní domácnost (ukázková se nepočítá)
create or replace function public.limit_free_households() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'owner'
     and not exists (select 1 from public.households where id = new.household_id and is_demo)
     and not public.user_is_premium(new.user_id)
     and (select count(*) from public.household_users hu join public.households h on h.id = hu.household_id
          where hu.user_id = new.user_id and hu.role = 'owner' and not h.is_demo) >= 1 then
    raise exception 'PREMIUM: Verze zdarma umožňuje 1 vlastní domácnost. Pro další aktivujte Premium.';
  end if;
  return new;
end $$;
create trigger household_users_free_limit before insert on public.household_users for each row execute function public.limit_free_households();

-- Stávající administrátor má Premium napořád
insert into public.subscriptions (user_id, status, source, variant, note)
  select id, 'granted', 'admin', 'lifetime', 'Administrátor aplikace' from auth.users where lower(email) = 'adamhorvath07@icloud.com'
  on conflict (user_id) do nothing;

-- Smazání účtu nesmí smazat domácnost, ve které jsou další lidé (vlastnictví se předá)
alter table public.households alter column created_by drop not null;
alter table public.households drop constraint households_created_by_fkey;
alter table public.households add constraint households_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;
