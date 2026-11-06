-- HomeOS – Row Level Security
-- Uživatel vidí a mění jen data domácností, jejichž je členem (household_users).

create or replace function public.is_household_member(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_users where household_id = hid and user_id = auth.uid());
$$;

create or replace function public.is_household_owner(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_users where household_id = hid and user_id = auth.uid() and role = 'owner');
$$;

revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.is_household_owner(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;

-- anonymní role nemá k datům žádný přístup
revoke all on all tables in schema public from anon;

-- households --------------------------------------------------------------
alter table public.households enable row level security;
create policy households_select on public.households for select to authenticated
  using (public.is_household_member(id) or created_by = auth.uid());
create policy households_insert on public.households for insert to authenticated
  with check (created_by = auth.uid());
create policy households_update on public.households for update to authenticated
  using (public.is_household_owner(id)) with check (public.is_household_owner(id));
create policy households_delete on public.households for delete to authenticated
  using (public.is_household_owner(id));

-- household_users ---------------------------------------------------------
alter table public.household_users enable row level security;
create policy hu_select on public.household_users for select to authenticated
  using (public.is_household_member(household_id));
-- zakladatel se smí přidat jako vlastník do domácnosti, kterou právě vytvořil
create policy hu_insert_founder on public.household_users for insert to authenticated
  with check (
    user_id = auth.uid() and role = 'owner'
    and exists (select 1 from public.households h where h.id = household_id and h.created_by = auth.uid())
  );
create policy hu_delete on public.household_users for delete to authenticated
  using (public.is_household_owner(household_id) or user_id = auth.uid());

-- household_invites -------------------------------------------------------
alter table public.household_invites enable row level security;
create policy inv_owner on public.household_invites for all to authenticated
  using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));

-- data domácnosti ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'household_settings', 'members', 'accounts', 'categories', 'documents', 'recurring_payments',
    'income_sources', 'occurrence_marks', 'budgets', 'savings_goals', 'savings_contributions',
    'work_settings', 'invoices', 'payouts', 'work_shifts', 'purchases', 'transactions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))',
      t || '_member', t);
  end loop;
end $$;

-- Přijetí pozvánky: bezpečně přes funkci (pozvaný ještě nemá přístup k domácnosti)
create or replace function public.accept_household_invite(invite_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.household_invites;
begin
  if auth.uid() is null then raise exception 'Nepřihlášený uživatel'; end if;
  select * into inv from public.household_invites
    where code = invite_code and used_by is null and expires_at > now()
    for update;
  if not found then raise exception 'Pozvánka neexistuje nebo vypršela'; end if;
  insert into public.household_users (household_id, user_id, role)
    values (inv.household_id, auth.uid(), 'member')
    on conflict (household_id, user_id) do nothing;
  update public.household_invites set used_by = auth.uid() where id = inv.id;
  return inv.household_id;
end $$;
revoke all on function public.accept_household_invite(text) from public, anon;
grant execute on function public.accept_household_invite(text) to authenticated;
