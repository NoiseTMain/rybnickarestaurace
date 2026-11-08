-- Recepty: lajky, uložené („Moje recepty“) a „uvařeno“ – osobní pro každého uživatele.
create table public.recipe_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null check (recipe_id ~ '^[a-z0-9-]{2,80}$'),
  liked boolean not null default false,
  saved boolean not null default false,
  cooked_count int not null default 0 check (cooked_count >= 0),
  last_cooked_at date,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);
create index recipe_reactions_liked_idx on public.recipe_reactions (recipe_id) where liked;
alter table public.recipe_reactions enable row level security;
create policy recipe_reactions_own on public.recipe_reactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.recipe_reactions from anon;
grant select, insert, update, delete on public.recipe_reactions to authenticated;

-- Počty lajků pro všechny (bez prozrazení, kdo lajkoval).
create or replace function public.recipe_like_counts()
returns table (recipe_id text, likes bigint)
language sql stable security definer set search_path = public as $$
  select recipe_id, count(*) from public.recipe_reactions where liked group by recipe_id;
$$;
revoke all on function public.recipe_like_counts() from public, anon;
grant execute on function public.recipe_like_counts() to authenticated;
