-- Oprava: zakladatel domácnosti musí vidět svůj vlastní nový záznam členství.
-- INSERT … RETURNING (supabase-js .insert().select()) kontroluje i SELECT politiku;
-- funkce is_household_member v rámci téhož příkazu nový řádek ještě nevidí.
drop policy if exists hu_select on public.household_users;
create policy hu_select on public.household_users for select to authenticated
  using (user_id = auth.uid() or public.is_household_member(household_id));
