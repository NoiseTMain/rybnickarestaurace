-- HomeOS – cestování: cesty, úseky trasy (vlak, bus, auto, letadlo…) a výdaje na cestě

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  destination text not null check (char_length(destination) between 1 and 120),
  country text check (country is null or char_length(country) <= 60),
  start_date date,
  end_date date,
  travelers int not null default 1 check (travelers between 1 and 50),
  budget bigint check (budget is null or budget >= 0),
  currency text not null default 'CZK' check (currency ~ '^[A-Z]{3}$'),
  lat double precision,
  lon double precision,
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  unique (household_id, id),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.trip_legs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  trip_id uuid not null,
  mode text not null check (mode in ('train', 'bus', 'car', 'plane', 'ferry', 'transit', 'bike', 'other')),
  carrier text check (carrier is null or char_length(carrier) <= 80),
  from_place text not null check (char_length(from_place) between 1 and 120),
  to_place text not null check (char_length(to_place) between 1 and 120),
  depart_date date,
  depart_time text check (depart_time is null or depart_time ~ '^\d{2}:\d{2}$'),
  arrive_date date,
  arrive_time text check (arrive_time is null or arrive_time ~ '^\d{2}:\d{2}$'),
  price bigint check (price is null or price >= 0),
  distance_km int check (distance_km is null or distance_km between 0 and 50000),
  booking_ref text check (booking_ref is null or char_length(booking_ref) <= 80),
  url text check (url is null or char_length(url) <= 1000),
  note text check (note is null or char_length(note) <= 1000),
  from_lat double precision,
  from_lon double precision,
  to_lat double precision,
  to_lon double precision,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, trip_id) references public.trips (household_id, id) on delete cascade
);
create index on public.trip_legs (trip_id);

alter table public.transactions drop constraint transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('manual', 'csv', 'payout', 'recurring', 'invoice', 'purchase', 'income_source', 'savings', 'shopping', 'trip'));

alter table public.transactions add constraint transactions_household_id_key unique (household_id, id);

create table public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  trip_id uuid not null,
  leg_id uuid,
  transaction_id uuid,
  status text not null default 'paid' check (status in ('planned', 'paid')),
  kind text not null check (kind in ('transport', 'accommodation', 'food', 'activities', 'shopping', 'other')),
  description text not null check (char_length(description) between 1 and 200),
  place text check (place is null or char_length(place) <= 120),
  date date,
  amount bigint not null check (amount >= 0),
  currency text not null default 'CZK' check (currency ~ '^[A-Z]{3}$'),
  amount_original bigint check (amount_original is null or amount_original >= 0),
  rate numeric(14, 6) check (rate is null or rate > 0),
  created_at timestamptz not null default now(),
  foreign key (household_id, trip_id) references public.trips (household_id, id) on delete cascade,
  foreign key (household_id, leg_id) references public.trip_legs (household_id, id) on delete set null (leg_id),
  foreign key (household_id, transaction_id) references public.transactions (household_id, id) on delete set null (transaction_id)
);
create index on public.trip_expenses (trip_id);
create unique index trip_expenses_unique_tx on public.trip_expenses (transaction_id) where transaction_id is not null;
create unique index trip_expenses_unique_leg on public.trip_expenses (leg_id) where leg_id is not null;

-- RLS: číst smí každý člen, zapisovat podle oprávnění sekce „travel“
alter table public.trips enable row level security;
alter table public.trip_legs enable row level security;
alter table public.trip_expenses enable row level security;
do $$
declare t text;
begin
  foreach t in array array['trips', 'trip_legs', 'trip_expenses'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_household_perm(household_id, %L))', t || '_insert', t, 'travel');
    execute format('create policy %I on public.%I for update to authenticated using (public.has_household_perm(household_id, %L)) with check (public.has_household_perm(household_id, %L))', t || '_update', t, 'travel', 'travel');
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_household_perm(household_id, %L))', t || '_delete', t, 'travel');
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- dokumenty (jízdenky) smí nahrát i ten, kdo může upravovat jen cestování
create or replace function public.has_any_household_edit(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_users hu
    where hu.household_id = hid and hu.user_id = auth.uid()
      and (hu.role = 'owner' or exists (
        select 1 from unnest(array['finance', 'invoices', 'work', 'purchases', 'savings', 'settings', 'travel']) as s(section)
        where coalesce(hu.permissions ->> s.section, 'edit') = 'edit'))
  );
$$;
