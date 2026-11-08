-- Výzvy (měsíční cíle chování) a večerní souhrn dne
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind text not null check (kind in ('no_takeout', 'no_spend_days', 'save_amount', 'category_cut', 'daily_log')),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  target bigint not null default 0 check (target >= 0),
  category_id uuid references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (household_id, kind, month)
);
create index challenges_household_idx on public.challenges (household_id, month);

alter table public.challenges enable row level security;
create policy challenges_select on public.challenges for select to authenticated using (public.is_household_member(household_id));
create policy challenges_insert on public.challenges for insert to authenticated with check (public.has_household_perm(household_id, 'finance'));
create policy challenges_update on public.challenges for update to authenticated using (public.has_household_perm(household_id, 'finance')) with check (public.has_household_perm(household_id, 'finance'));
create policy challenges_delete on public.challenges for delete to authenticated using (public.has_household_perm(household_id, 'finance'));
revoke all on public.challenges from anon;
grant select, insert, update, delete on public.challenges to authenticated;

alter table public.user_prefs add column daily_digest boolean not null default false;
