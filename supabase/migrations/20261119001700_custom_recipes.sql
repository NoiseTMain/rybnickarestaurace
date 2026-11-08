-- Vlastní recepty domácnosti (Premium): název, kategorie, suroviny, postup a fotka.
create table public.custom_recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 2 and 120),
  course text not null default 'hlavni' check (course in ('snidane', 'polevka', 'salat', 'bowl', 'testoviny', 'hlavni', 'svacina', 'dezert')),
  time_min int check (time_min is null or time_min between 1 and 1440),
  servings int not null default 2 check (servings between 1 and 20),
  kcal int check (kcal is null or kcal between 0 and 5000),
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) <= 60),
  steps text check (steps is null or char_length(steps) <= 8000),
  note text check (note is null or char_length(note) <= 1000),
  photo_document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_recipes_photo_fk foreign key (household_id, photo_document_id)
    references public.documents (household_id, id) on delete set null (photo_document_id)
);
create index custom_recipes_household_idx on public.custom_recipes (household_id, created_at desc);

alter table public.custom_recipes enable row level security;
create policy custom_recipes_select on public.custom_recipes for select to authenticated using (public.is_household_member(household_id));
create policy custom_recipes_insert on public.custom_recipes for insert to authenticated
  with check (public.has_household_perm(household_id, 'purchases') and public.household_is_premium(household_id));
create policy custom_recipes_update on public.custom_recipes for update to authenticated
  using (public.has_household_perm(household_id, 'purchases'))
  with check (public.has_household_perm(household_id, 'purchases') and public.household_is_premium(household_id));
create policy custom_recipes_delete on public.custom_recipes for delete to authenticated using (public.has_household_perm(household_id, 'purchases'));
revoke all on public.custom_recipes from anon;
grant select, insert, update, delete on public.custom_recipes to authenticated;

create trigger custom_recipes_updated_at before update on public.custom_recipes for each row execute function public.set_updated_at();
