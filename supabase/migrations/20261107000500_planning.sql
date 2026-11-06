-- HomeOS – plánování: nákupní seznamy jídla, fotky a místnosti u nákupů

-- Nákupy: druh (obecný / domácnost a nábytek), místnost, fotka z úložiště
alter table public.purchases
  add column kind text not null default 'general' check (kind in ('general', 'home')),
  add column room text check (room is null or char_length(room) <= 60),
  add column image_document_id uuid,
  add column source_url_title text,
  add constraint purchases_image_fk foreign key (household_id, image_document_id)
    references public.documents (household_id, id) on delete set null (image_document_id);

-- Nákupní seznamy jídla
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  planned_date date,
  status text not null default 'open' check (status in ('open', 'done')),
  note text,
  created_at timestamptz not null default now(),
  unique (household_id, id)
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  quantity text check (quantity is null or char_length(quantity) <= 30),
  est_price bigint check (est_price is null or est_price >= 0),
  checked boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  foreign key (household_id, list_id) references public.shopping_lists (household_id, id) on delete cascade
);
create index on public.shopping_items (list_id);

-- Vazba výdaje na nákupní seznam (jeden seznam = nejvýše jeden platný výdaj)
alter table public.transactions
  add column shopping_list_id uuid,
  add constraint transactions_shopping_list_fk foreign key (household_id, shopping_list_id)
    references public.shopping_lists (household_id, id) on delete set null (shopping_list_id);
alter table public.transactions drop constraint transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('manual', 'csv', 'payout', 'recurring', 'invoice', 'purchase', 'income_source', 'savings', 'shopping'));
create unique index tx_unique_shopping on public.transactions (shopping_list_id) where shopping_list_id is not null and status = 'posted';

-- RLS
alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;
create policy shopping_lists_member on public.shopping_lists for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy shopping_items_member on public.shopping_items for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
revoke all on public.shopping_lists, public.shopping_items from anon;
