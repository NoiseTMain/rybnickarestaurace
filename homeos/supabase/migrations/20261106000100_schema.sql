-- HomeOS – schéma databáze
-- Všechny peněžní částky jsou v HALÉŘÍCH (bigint). 1 Kč = 100.
-- Každá tabulka s daty domácnosti má household_id a složené cizí klíče
-- (household_id, id), takže záznam nemůže odkazovat na data jiné domácnosti.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Domácnosti a přístup

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  is_demo boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_users (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);
create index on public.household_users (user_id);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code text not null unique check (char_length(code) >= 10),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  safety_buffer bigint not null default 0 check (safety_buffer >= 0),
  food_warn_percent int not null default 85 check (food_warn_percent between 1 and 100),
  pace_tolerance_percent int not null default 10 check (pace_tolerance_percent between 0 and 100),
  notify_due_days int not null default 5 check (notify_due_days between 0 and 60),
  notify_food boolean not null default true,
  notify_invoices boolean not null default true,
  notify_payments boolean not null default true,
  billing_name text,
  billing_ico text check (billing_ico is null or billing_ico ~ '^\d{8}$'),
  billing_dic text,
  billing_address text,
  billing_bank_account text,
  invoice_number_prefix text,
  onboarded_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Členové, účty, kategorie

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#d4b483',
  user_id uuid references auth.users (id) on delete set null,
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, id)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'checking' check (kind in ('checking', 'cash', 'savings')),
  opening_balance bigint not null default 0,
  opening_date date not null default current_date,
  include_in_available boolean not null default true,
  member_id uuid,
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, member_id) references public.members (household_id, id) on delete set null (member_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  icon text not null default 'circle',
  color text not null default '#d4b483',
  is_food boolean not null default false,
  is_household boolean not null default false,
  is_archived boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  unique (household_id, kind, name)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind text not null default 'other' check (kind in ('invoice', 'receipt', 'contract', 'statement', 'other')),
  title text not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  ocr_text text,
  tags text,
  uploaded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  -- soubor musí ležet ve složce své domácnosti
  check (storage_path like household_id::text || '/%')
);

-- ---------------------------------------------------------------------------
-- Pravidelné platby a příjmy

create table public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  amount bigint not null check (amount > 0),
  frequency text not null check (frequency in ('once', 'weekly', 'monthly', 'quarterly', 'yearly')),
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  category_id uuid,
  account_id uuid,
  member_id uuid,
  payment_method text not null default 'transfer' check (payment_method in ('card', 'cash', 'transfer', 'direct_debit', 'other')),
  is_debt boolean not null default false,
  debt_remaining bigint check (debt_remaining is null or debt_remaining >= 0),
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, category_id) references public.categories (household_id, id) on delete set null (category_id),
  foreign key (household_id, account_id) references public.accounts (household_id, id) on delete set null (account_id),
  foreign key (household_id, member_id) references public.members (household_id, id) on delete set null (member_id)
);

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  amount bigint not null check (amount > 0),
  frequency text not null check (frequency in ('once', 'weekly', 'monthly', 'quarterly', 'yearly')),
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  member_id uuid,
  account_id uuid,
  category_id uuid,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, member_id) references public.members (household_id, id) on delete set null (member_id),
  foreign key (household_id, account_id) references public.accounts (household_id, id) on delete set null (account_id),
  foreign key (household_id, category_id) references public.categories (household_id, id) on delete set null (category_id)
);

create table public.occurrence_marks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recurring_payment_id uuid,
  income_source_id uuid,
  occurrence_date date not null,
  state text not null check (state in ('paid_untracked', 'skipped')),
  created_at timestamptz not null default now(),
  check ((recurring_payment_id is null) <> (income_source_id is null)),
  foreign key (household_id, recurring_payment_id) references public.recurring_payments (household_id, id) on delete cascade,
  foreign key (household_id, income_source_id) references public.income_sources (household_id, id) on delete cascade
);
create unique index occurrence_marks_rp on public.occurrence_marks (recurring_payment_id, occurrence_date) where recurring_payment_id is not null;
create unique index occurrence_marks_is on public.occurrence_marks (income_source_id, occurrence_date) where income_source_id is not null;

-- ---------------------------------------------------------------------------
-- Rozpočty a spoření

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind text not null check (kind in ('food', 'category', 'total')),
  category_id uuid,
  amount bigint not null check (amount >= 0),
  month date check (month is null or extract(day from month) = 1),
  created_at timestamptz not null default now(),
  check ((kind = 'category') = (category_id is not null)),
  foreign key (household_id, category_id) references public.categories (household_id, id) on delete cascade
);
create unique index budgets_unique on public.budgets (household_id, kind, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(month, '1900-01-01'::date));

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind text not null default 'other' check (kind in ('reserve', 'home', 'car', 'vacation', 'business', 'other')),
  target_amount bigint not null check (target_amount > 0),
  target_date date,
  monthly_contribution bigint check (monthly_contribution is null or monthly_contribution >= 0),
  account_id uuid,
  color text not null default '#d4b483',
  priority int not null default 3 check (priority between 1 and 5),
  status text not null default 'active' check (status in ('active', 'achieved', 'archived')),
  note text,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, account_id) references public.accounts (household_id, id) on delete set null (account_id)
);

create table public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  goal_id uuid not null,
  amount bigint not null check (amount <> 0),
  date date not null,
  note text,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, goal_id) references public.savings_goals (household_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Práce

create table public.work_settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  member_id uuid,
  company text not null default 'Rohlík',
  rate_hour bigint not null default 0 check (rate_hour >= 0),
  rate_regular_route bigint not null default 0 check (rate_regular_route >= 0),
  rate_express_route bigint not null default 0 check (rate_express_route >= 0),
  rate_order bigint not null default 0 check (rate_order >= 0),
  rate_peak_hour_bonus bigint not null default 0 check (rate_peak_hour_bonus >= 0),
  private_km_rate bigint not null default 0 check (private_km_rate >= 0),
  default_vehicle_rent bigint not null default 0 check (default_vehicle_rent >= 0),
  updated_at timestamptz not null default now(),
  foreign key (household_id, member_id) references public.members (household_id, id) on delete set null (member_id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  direction text not null check (direction in ('issued', 'received')),
  number text not null check (char_length(number) between 1 and 60),
  counterparty text not null check (char_length(counterparty) between 1 and 200),
  counterparty_ico text check (counterparty_ico is null or counterparty_ico ~ '^\d{8}$'),
  issue_date date not null,
  due_date date check (due_date is null or due_date >= issue_date),
  paid_date date,
  amount bigint not null check (amount > 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'cancelled')),
  include_in_plan boolean not null default true,
  note text,
  document_id uuid,
  ocr_used boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  unique (household_id, direction, number),
  check ((status = 'paid') = (paid_date is not null)),
  foreign key (household_id, document_id) references public.documents (household_id, id) on delete set null (document_id)
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid,
  label text not null check (char_length(label) between 1 and 120),
  period_from date,
  period_to date check (period_to is null or period_from is null or period_to >= period_from),
  expected_amount bigint not null check (expected_amount >= 0),
  expected_date date not null,
  received_amount bigint check (received_amount is null or received_amount >= 0),
  received_date date,
  status text not null default 'expected' check (status in ('expected', 'received', 'cancelled')),
  account_id uuid,
  invoice_id uuid,
  note text,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  check ((status = 'received') = (received_amount is not null and received_date is not null)),
  foreign key (household_id, member_id) references public.members (household_id, id) on delete set null (member_id),
  foreign key (household_id, account_id) references public.accounts (household_id, id) on delete set null (account_id),
  foreign key (household_id, invoice_id) references public.invoices (household_id, id) on delete set null (invoice_id)
);

create table public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid,
  date date not null,
  minutes int not null default 0 check (minutes between 0 and 1440),
  peak_minutes int not null default 0 check (peak_minutes between 0 and 1440),
  regular_routes int not null default 0 check (regular_routes >= 0),
  express_routes int not null default 0 check (express_routes >= 0),
  orders int not null default 0 check (orders >= 0),
  base_earnings bigint not null default 0 check (base_earnings >= 0),
  tips bigint not null default 0 check (tips >= 0),
  bonuses bigint not null default 0 check (bonuses >= 0),
  rewards bigint not null default 0 check (rewards >= 0),
  vehicle_rent bigint not null default 0 check (vehicle_rent >= 0),
  equipment_cost bigint not null default 0 check (equipment_cost >= 0),
  private_km numeric(10, 1) not null default 0 check (private_km >= 0),
  private_km_cost bigint not null default 0 check (private_km_cost >= 0),
  other_deductions bigint not null default 0 check (other_deductions >= 0),
  note text,
  external_id text,
  created_at timestamptz not null default now(),
  check (peak_minutes <= minutes),
  foreign key (household_id, member_id) references public.members (household_id, id) on delete set null (member_id)
);
create unique index work_shifts_external on public.work_shifts (household_id, external_id) where external_id is not null;
create index on public.work_shifts (household_id, date);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  price bigint not null check (price >= 0),
  category_id uuid,
  priority int not null default 3 check (priority between 1 and 5),
  url text check (url is null or url ~* '^https?://'),
  planned_date date,
  status text not null default 'planned' check (status in ('planned', 'buying', 'bought')),
  is_wish boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, category_id) references public.categories (household_id, id) on delete set null (category_id)
);

-- ---------------------------------------------------------------------------
-- Transakce (pohyby na účtech)

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'transfer')),
  status text not null default 'posted' check (status in ('posted', 'cancelled')),
  amount bigint not null check (amount > 0),
  date date not null,
  account_id uuid not null,
  transfer_account_id uuid,
  category_id uuid,
  description text not null default '',
  member_id uuid,
  scope text not null default 'shared' check (scope in ('shared', 'personal')),
  is_recurring boolean not null default false,
  payment_method text not null default 'card' check (payment_method in ('card', 'cash', 'transfer', 'direct_debit', 'other')),
  source text not null default 'manual' check (source in ('manual', 'csv', 'payout', 'recurring', 'invoice', 'purchase', 'income_source', 'savings')),
  external_id text,
  recurring_payment_id uuid,
  income_source_id uuid,
  occurrence_date date,
  payout_id uuid,
  invoice_id uuid,
  purchase_id uuid,
  contribution_id uuid,
  document_id uuid,
  note text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((type = 'transfer') = (transfer_account_id is not null)),
  check (transfer_account_id is null or transfer_account_id <> account_id),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  check ((recurring_payment_id is null and income_source_id is null) or occurrence_date is not null),
  foreign key (household_id, account_id) references public.accounts (household_id, id) on delete restrict,
  foreign key (household_id, transfer_account_id) references public.accounts (household_id, id) on delete restrict,
  foreign key (household_id, category_id) references public.categories (household_id, id) on delete set null (category_id),
  foreign key (household_id, member_id) references public.members (household_id, id) on delete set null (member_id),
  foreign key (household_id, recurring_payment_id) references public.recurring_payments (household_id, id) on delete set null (recurring_payment_id),
  foreign key (household_id, income_source_id) references public.income_sources (household_id, id) on delete set null (income_source_id),
  foreign key (household_id, payout_id) references public.payouts (household_id, id) on delete set null (payout_id),
  foreign key (household_id, invoice_id) references public.invoices (household_id, id) on delete set null (invoice_id),
  foreign key (household_id, purchase_id) references public.purchases (household_id, id) on delete set null (purchase_id),
  foreign key (household_id, contribution_id) references public.savings_contributions (household_id, id) on delete set null (contribution_id),
  foreign key (household_id, document_id) references public.documents (household_id, id) on delete set null (document_id)
);
create index on public.transactions (household_id, date);
-- Ochrana proti dvojímu započtení: jeden zdroj = nejvýše jedna platná transakce.
create unique index tx_unique_external on public.transactions (household_id, account_id, external_id) where external_id is not null;
create unique index tx_unique_recurring on public.transactions (recurring_payment_id, occurrence_date) where recurring_payment_id is not null and status = 'posted';
create unique index tx_unique_income_source on public.transactions (income_source_id, occurrence_date) where income_source_id is not null and status = 'posted';
create unique index tx_unique_payout on public.transactions (payout_id) where payout_id is not null and status = 'posted';
create unique index tx_unique_invoice on public.transactions (invoice_id) where invoice_id is not null and status = 'posted';
create unique index tx_unique_purchase on public.transactions (purchase_id) where purchase_id is not null and status = 'posted';
create unique index tx_unique_contribution on public.transactions (contribution_id) where contribution_id is not null and status = 'posted';

create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger household_settings_updated_at before update on public.household_settings
  for each row execute function public.set_updated_at();
create trigger work_settings_updated_at before update on public.work_settings
  for each row execute function public.set_updated_at();
