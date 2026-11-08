-- HomeOS – provoz a nové funkce: záznam chyb, limit přihlášení, průvodce, majetek a dluhy, termíny,
-- děti a kapesné, doporuč kamarádovi, protokol upozornění

-- Záznam chyb aplikace (zapisuje jen server)
create table public.app_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  path text check (char_length(path) <= 300),
  message text not null check (char_length(message) <= 2000),
  stack text check (stack is null or char_length(stack) <= 8000),
  digest text check (digest is null or char_length(digest) <= 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index on public.app_errors (created_at desc);
alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon, authenticated;

-- Pokusy o přihlášení (ochrana proti hádání hesla; jen server)
create table public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  key text not null check (char_length(key) = 64),
  ok boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.login_attempts (key, created_at desc);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

-- Protokol odeslaných upozornění (aby se nic neposlalo dvakrát; jen server)
create table public.notification_log (
  key text not null check (char_length(key) <= 200),
  date date not null,
  created_at timestamptz not null default now(),
  primary key (key, date)
);
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;

alter table public.user_prefs add column tour_seen_at timestamptz;

-- Majetek (pro čisté jmění)
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (kind in ('investment', 'property', 'vehicle', 'pension', 'other')),
  value bigint not null check (value >= 0),
  note text check (note is null or char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.assets (household_id);

-- Dluhy (plán splacení, čisté jmění)
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  balance bigint not null check (balance >= 0),
  rate numeric(6, 3) not null default 0 check (rate >= 0 and rate <= 200),
  min_payment bigint not null default 0 check (min_payment >= 0),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index on public.debts (household_id);

-- Měsíční snímky čistého jmění (graf v čase)
create table public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  assets bigint not null,
  liabilities bigint not null,
  created_at timestamptz not null default now(),
  unique (household_id, month)
);

-- Hlídač termínů (záruky, STK, pojištění, fixace, smlouvy)
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null check (kind in ('warranty', 'stk', 'insurance', 'fixation', 'contract', 'document', 'tax', 'other')),
  due_date date not null,
  notify_days int not null default 14 check (notify_days between 0 and 365),
  repeat_yearly boolean not null default false,
  done boolean not null default false,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index on public.reminders (household_id, due_date);

-- Děti a kapesné
alter table public.members
  add column is_child boolean not null default false,
  add column pocket_money bigint check (pocket_money is null or pocket_money >= 0),
  add column pocket_frequency text check (pocket_frequency is null or pocket_frequency in ('weekly', 'monthly'));
alter table public.savings_goals
  add column member_id uuid,
  add constraint savings_goals_member_fk foreign key (household_id, member_id) references public.members (household_id, id) on delete set null (member_id);

-- Doporuč kamarádovi (zapisuje jen server)
create table public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
create policy referral_codes_own on public.referral_codes for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.referral_codes from authenticated;
revoke all on public.referral_codes from anon;
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referred_id uuid not null unique references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'rewarded', 'rejected')),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  check (referrer_id <> referred_id)
);
alter table public.referrals enable row level security;
create policy referrals_own on public.referrals for select to authenticated using (referrer_id = auth.uid() or referred_id = auth.uid());
revoke insert, update, delete on public.referrals from authenticated;
revoke all on public.referrals from anon;

-- RLS pro data domácnosti (sekce Příjmy a výdaje)
do $$
declare t text;
begin
  foreach t in array array['assets', 'debts', 'net_worth_snapshots', 'reminders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_household_perm(household_id, %L))', t || '_insert', t, 'finance');
    execute format('create policy %I on public.%I for update to authenticated using (public.has_household_perm(household_id, %L)) with check (public.has_household_perm(household_id, %L))', t || '_update', t, 'finance', 'finance');
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_household_perm(household_id, %L))', t || '_delete', t, 'finance');
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
