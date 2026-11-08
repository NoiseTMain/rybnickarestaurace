-- HomeOS – zkušební období (jen jednou na e-mail) a uživatelské předvolby

-- Využitá zkušební období: hash e-mailu (přežije i smazání účtu → nejde opakovat přes nový účet se stejným e-mailem)
create table public.trial_claims (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid,
  card text check (card is null or char_length(card) <= 40),
  created_at timestamptz not null default now()
);
alter table public.trial_claims enable row level security;
revoke all on public.trial_claims from anon, authenticated;

-- Předvolby uživatele: životní situace, skryté sekce, jazyk, zobrazená nabídka Premium
create table public.user_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile text check (profile is null or profile in ('family', 'couple', 'single', 'single_parent', 'student', 'senior', 'entrepreneur', 'freelancer', 'courier')),
  hidden_sections text[] not null default '{}',
  locale text not null default 'cs' check (locale in ('cs', 'sk', 'en')),
  promo_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_prefs enable row level security;
create policy user_prefs_own on public.user_prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.user_prefs from anon;
