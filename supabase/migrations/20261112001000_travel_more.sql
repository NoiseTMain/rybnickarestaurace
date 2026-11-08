-- HomeOS – cestování 3: vyrovnání (zaplacené převody), účet pro QR platbu, sdílení cesty, rozpočet po kategoriích

alter table public.trip_people add column account text check (account is null or char_length(account) <= 40);

create table public.trip_settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  trip_id uuid not null,
  from_person uuid not null,
  to_person uuid not null,
  amount bigint not null check (amount > 0),
  date date not null default current_date,
  created_at timestamptz not null default now(),
  foreign key (household_id, trip_id) references public.trips (household_id, id) on delete cascade,
  foreign key (household_id, from_person) references public.trip_people (household_id, id) on delete cascade,
  foreign key (household_id, to_person) references public.trip_people (household_id, id) on delete cascade,
  check (from_person <> to_person)
);
create index on public.trip_settlements (trip_id);
alter table public.trip_settlements enable row level security;
create policy trip_settlements_select on public.trip_settlements for select to authenticated using (public.is_household_member(household_id));
create policy trip_settlements_insert on public.trip_settlements for insert to authenticated with check (public.has_household_perm(household_id, 'travel') and public.household_is_premium(household_id));
create policy trip_settlements_delete on public.trip_settlements for delete to authenticated using (public.has_household_perm(household_id, 'travel'));
revoke all on public.trip_settlements from anon;

-- Sdílení cesty odkazem jen pro čtení (náhodný token; stránku vykresluje server)
alter table public.trips
  add column share_token text unique check (share_token is null or char_length(share_token) between 20 and 64),
  add column category_budgets jsonb check (category_budgets is null or jsonb_typeof(category_budgets) = 'object');
