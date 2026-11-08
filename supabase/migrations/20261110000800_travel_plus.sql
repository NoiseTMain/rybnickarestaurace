-- HomeOS – cestování 2: účastníci a vyrovnání, hotovost v cizí měně, dokumenty, seznam úkolů,
-- program po dnech, vazba na cíl spoření, trasa po silnici

-- Účastníci cesty (nemusí mít účet v aplikaci)
create table public.trip_people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  trip_id uuid not null,
  name text not null check (char_length(name) between 1 and 60),
  member_id uuid,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, trip_id) references public.trips (household_id, id) on delete cascade,
  foreign key (household_id, member_id) references public.members (household_id, id) on delete set null (member_id)
);
create index on public.trip_people (trip_id);

-- Hotovost v cizí měně: výměna / výběr z bankomatu a vrácení zbytku
create table public.trip_cash_moves (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  trip_id uuid not null,
  kind text not null check (kind in ('buy', 'return')),
  currency text not null check (currency ~ '^[A-Z]{3}$' and currency <> 'CZK'),
  amount_original bigint not null check (amount_original > 0),
  amount bigint not null check (amount >= 0),
  rate numeric(14, 6) not null check (rate > 0),
  date date not null,
  transaction_id uuid,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  foreign key (household_id, trip_id) references public.trips (household_id, id) on delete cascade,
  foreign key (household_id, transaction_id) references public.transactions (household_id, id) on delete set null (transaction_id)
);
create index on public.trip_cash_moves (trip_id);

-- Výdaje: kdo platil, za koho, z hotovosti v cizí měně, příloha
alter table public.trip_expenses
  add column paid_by uuid,
  add column split_among uuid[],
  add column from_cash boolean not null default false,
  add column document_id uuid,
  add constraint trip_expenses_paid_by_fk foreign key (household_id, paid_by) references public.trip_people (household_id, id) on delete set null (paid_by),
  add constraint trip_expenses_document_fk foreign key (household_id, document_id) references public.documents (household_id, id) on delete set null (document_id);

-- Úseky: jízdenka a trasa po silnici (zakódovaná lomená čára)
alter table public.trip_legs
  add column document_id uuid,
  add column route_polyline text check (route_polyline is null or char_length(route_polyline) <= 20000),
  add constraint trip_legs_document_fk foreign key (household_id, document_id) references public.documents (household_id, id) on delete set null (document_id);

-- Dokumenty přiřazené k cestě (rezervace, pojištění…)
alter table public.documents
  add column trip_id uuid,
  add constraint documents_trip_fk foreign key (household_id, trip_id) references public.trips (household_id, id) on delete set null (trip_id);

-- Cesta: vazba na cíl spoření (pak se rezerva drží v cíli, ne v plánovači)
alter table public.trips
  add column goal_id uuid,
  add constraint trips_goal_fk foreign key (household_id, goal_id) references public.savings_goals (household_id, id) on delete set null (goal_id);

-- Co vyřídit a sbalit
create table public.trip_checklist (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  trip_id uuid not null,
  text text not null check (char_length(text) between 1 and 120),
  category text check (category is null or char_length(category) <= 40),
  done boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  foreign key (household_id, trip_id) references public.trips (household_id, id) on delete cascade
);
create index on public.trip_checklist (trip_id);

-- Program po dnech: ubytování, výlety, poznámky
create table public.trip_plan_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  trip_id uuid not null,
  kind text not null check (kind in ('stay', 'activity', 'note')),
  date date,
  end_date date,
  time text check (time is null or time ~ '^\d{2}:\d{2}$'),
  title text not null check (char_length(title) between 1 and 120),
  address text check (address is null or char_length(address) <= 200),
  url text check (url is null or char_length(url) <= 1000),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (household_id, trip_id) references public.trips (household_id, id) on delete cascade,
  check (end_date is null or date is null or end_date >= date)
);
create index on public.trip_plan_items (trip_id);

-- Upozornění: aby se stejné upozornění neposlalo dvakrát
create table public.trip_notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  trip_id uuid not null,
  kind text not null check (kind in ('departure', 'overspend')),
  date date not null,
  created_at timestamptz not null default now(),
  unique (trip_id, kind, date),
  foreign key (household_id, trip_id) references public.trips (household_id, id) on delete cascade
);

-- RLS
do $$
declare t text;
begin
  foreach t in array array['trip_people', 'trip_cash_moves', 'trip_checklist', 'trip_plan_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_household_perm(household_id, %L))', t || '_insert', t, 'travel');
    execute format('create policy %I on public.%I for update to authenticated using (public.has_household_perm(household_id, %L)) with check (public.has_household_perm(household_id, %L))', t || '_update', t, 'travel', 'travel');
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_household_perm(household_id, %L))', t || '_delete', t, 'travel');
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
-- záznamy o odeslaných upozorněních zapisuje jen server (service role); členové je mohou číst
alter table public.trip_notifications enable row level security;
create policy trip_notifications_select on public.trip_notifications for select to authenticated using (public.is_household_member(household_id));
revoke all on public.trip_notifications from anon;
