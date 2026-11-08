-- Widget na plochu: tajný odkaz jen pro čtení několika čísel („dnes můžete utratit…“).
-- Ukládá se jen hash tokenu; čte a zapisuje výhradně server (service role).
create table public.widget_tokens (
  token_hash text primary key check (char_length(token_hash) = 64),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.widget_tokens enable row level security;
revoke all on public.widget_tokens from anon, authenticated;
