-- =====================================================================
-- Restaurace Rybníky – databázové schéma
-- Supabase (PostgreSQL 15+). Spouští se přes `supabase db push`
-- nebo vložením do SQL editoru v Supabase dashboardu.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Administrátoři
-- Účty se zakládají v Supabase Auth (registrace je vypnutá) a do této
-- tabulky se přidávají ručně – viz README. Jen tito uživatelé smí
-- cokoliv měnit.
-- ---------------------------------------------------------------------
create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- Pomocný trigger pro updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Veřejné nastavení webu (jediný řádek, id = 1)
-- ---------------------------------------------------------------------
create table public.site_settings (
  id                 smallint primary key default 1 check (id = 1),
  restaurant_name    text not null default 'Restaurace Rybníky',
  phone              text not null,
  email              text not null,
  address_street     text not null,
  address_zip        text not null,
  address_city       text not null,
  latitude           double precision,
  longitude          double precision,
  -- [{ "day": 1..7 (1 = pondělí), "closed": bool, "intervals": [{ "open": "11:00", "close": "22:00" }] }]
  opening_hours      jsonb not null default '[]'::jsonb,
  opening_hours_note text,
  -- [{ "key": "wifi", "label": "Wi-Fi", "enabled": true }]
  services           jsonb not null default '[]'::jsonb,
  -- volné texty webu (hero, o nás, …), klíče viz src/lib/types.ts
  texts              jsonb not null default '{}'::jsonb,
  logo_path          text,
  hero_image_path    text,
  facebook_url       text,
  instagram_url      text,
  updated_at         timestamptz not null default now(),
  constraint site_settings_opening_hours_is_array check (jsonb_typeof(opening_hours) = 'array'),
  constraint site_settings_services_is_array check (jsonb_typeof(services) = 'array'),
  constraint site_settings_texts_is_object check (jsonb_typeof(texts) = 'object')
);

create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Neveřejné nastavení (příjemci e-mailů) – čte jen administrátor
-- ---------------------------------------------------------------------
create table public.private_settings (
  id                     smallint primary key default 1 check (id = 1),
  menu_email_recipient   text not null default 'info@rybnickarestaurace.cz',
  menu_email_enabled     boolean not null default true,
  inquiry_email_recipient text not null default 'info@rybnickarestaurace.cz',
  updated_at             timestamptz not null default now(),
  constraint private_settings_menu_email_format check (menu_email_recipient ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint private_settings_inquiry_email_format check (inquiry_email_recipient ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create trigger private_settings_touch before update on public.private_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Denní menu (PNG) + historie
-- ---------------------------------------------------------------------
create type public.menu_email_status as enum (
  'pending',   -- čeká na odeslání
  'sending',   -- právě se odesílá (zámek proti dvojímu odeslání)
  'sent',      -- e-mailová služba potvrdila přijetí požadavku
  'failed',    -- odeslání selhalo, lze zopakovat
  'skipped'    -- odesílání je v nastavení vypnuté
);

create table public.daily_menus (
  id                 uuid primary key default gen_random_uuid(),
  menu_date          date not null,
  storage_path       text not null unique,
  original_filename  text not null,
  file_size          integer not null check (file_size > 0 and file_size <= 15728640),
  width              integer check (width > 0),
  height             integer check (height > 0),
  sha256             text check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_at        timestamptz not null default now(),
  uploaded_by        uuid references auth.users (id) on delete set null,
  is_current         boolean not null default false,
  first_published_at timestamptz,
  published_at       timestamptz,
  publish_count      integer not null default 0,
  email_status       public.menu_email_status not null default 'pending',
  email_recipient    text,
  email_sent_at      timestamptz,
  email_provider_id  text,
  email_last_error   text,
  email_attempts     integer not null default 0,
  email_claimed_at   timestamptz,
  constraint daily_menus_path_format check (storage_path ~ '^[0-9]{4}/[0-9]{2}/[A-Za-z0-9._-]+\.png$'),
  constraint daily_menus_current_is_published check (not is_current or published_at is not null)
);

-- Aktuální může být vždy jen jedno menu
create unique index daily_menus_single_current on public.daily_menus (is_current) where is_current;
create index daily_menus_menu_date_idx on public.daily_menus (menu_date desc, uploaded_at desc);

-- Záznam o každém pokusu o odeslání e-mailu
create table public.menu_email_log (
  id                  uuid primary key default gen_random_uuid(),
  menu_id             uuid references public.daily_menus (id) on delete set null,
  menu_date           date,
  recipient           text not null,
  status              text not null check (status in ('sent', 'failed')),
  trigger             text not null check (trigger in ('auto', 'manual')),
  provider_message_id text,
  error               text,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now()
);

create index menu_email_log_menu_idx on public.menu_email_log (menu_id, created_at desc);

-- Zveřejnění menu: atomicky přepne aktuální menu, historii nemaže.
create or replace function public.publish_menu(p_menu_id uuid)
returns public.daily_menus
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_menu public.daily_menus;
begin
  if not public.is_admin() then
    raise exception 'Přístup odepřen' using errcode = '42501';
  end if;

  -- serializace souběžných zveřejnění
  perform pg_advisory_xact_lock(hashtext('public.publish_menu'));

  if not exists (select 1 from public.daily_menus where id = p_menu_id) then
    raise exception 'Menu nenalezeno' using errcode = 'P0002';
  end if;

  update public.daily_menus
     set is_current = false
   where is_current and id <> p_menu_id;

  update public.daily_menus
     set is_current = true,
         published_at = now(),
         first_published_at = coalesce(first_published_at, now()),
         publish_count = publish_count + 1
   where id = p_menu_id
  returning * into v_menu;

  return v_menu;
end;
$$;

-- Zámek pro odeslání e-mailu. Vrátí řádek jen tehdy, pokud se volajícímu
-- podařilo menu „zamknout“ – tím se brání dvojímu odeslání
-- (souběžné požadavky, obnovení stránky, dvojklik).
--   p_force = true  … vědomé opakované odeslání již odeslaného menu
create or replace function public.claim_menu_email(p_menu_id uuid, p_force boolean default false)
returns setof public.daily_menus
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Přístup odepřen' using errcode = '42501';
  end if;

  return query
  update public.daily_menus
     set email_status = 'sending',
         email_claimed_at = now(),
         email_attempts = email_attempts + 1
   where id = p_menu_id
     and (
          email_status in ('pending', 'failed')
       or (email_status = 'sending' and email_claimed_at < now() - interval '5 minutes')
       or (p_force and email_status in ('sent', 'skipped'))
     )
  returning *;
end;
$$;

revoke all on function public.publish_menu(uuid) from public;
revoke all on function public.claim_menu_email(uuid, boolean) from public;
grant execute on function public.publish_menu(uuid) to authenticated, service_role;
grant execute on function public.claim_menu_email(uuid, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Stálá nabídka – jídelní a nápojový lístek
-- ---------------------------------------------------------------------
create type public.menu_kind as enum ('food', 'drink');

create table public.menu_categories (
  id          uuid primary key default gen_random_uuid(),
  kind        public.menu_kind not null,
  name        text not null check (length(trim(name)) between 1 and 120),
  description text,
  sort_order  integer not null default 0,
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now()
);

create index menu_categories_kind_idx on public.menu_categories (kind, sort_order);

create table public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 200),
  description text,
  portion     text,          -- např. „150 g“, „0,5 l“
  price       numeric(10, 2) check (price is null or price >= 0),
  price_note  text,          -- např. „dle denní nabídky“
  allergens   text,          -- např. „1, 3, 7“
  sort_order  integer not null default 0,
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index menu_items_category_idx on public.menu_items (category_id, sort_order);
create trigger menu_items_touch before update on public.menu_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Prostory (výčep, salonky, sál, zahrádka)
-- ---------------------------------------------------------------------
create table public.spaces (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name          text not null,
  description   text,
  capacity      integer check (capacity is null or capacity > 0), -- vyplňovat jen ověřenou kapacitu
  capacity_note text,
  cover_path    text,
  sort_order    integer not null default 0,
  is_visible    boolean not null default true,
  updated_at    timestamptz not null default now()
);

create trigger spaces_touch before update on public.spaces
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Fotogalerie
-- ---------------------------------------------------------------------
create table public.gallery_photos (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  alt          text not null default '',
  category     text not null default 'restaurace'
               check (category in ('restaurace', 'jidlo', 'napoje', 'prostory', 'akce')),
  space_id     uuid references public.spaces (id) on delete set null,
  width        integer,
  height       integer,
  sort_order   integer not null default 0,
  is_visible   boolean not null default true,
  created_at   timestamptz not null default now()
);

create index gallery_photos_sort_idx on public.gallery_photos (sort_order, created_at desc);

-- ---------------------------------------------------------------------
-- Sportovní přenosy
-- ---------------------------------------------------------------------
create table public.sport_events (
  id          uuid primary key default gen_random_uuid(),
  starts_at   timestamptz not null,
  sport       text not null check (length(trim(sport)) between 1 and 60),
  title       text not null check (length(trim(title)) between 1 and 200),
  description text,
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now()
);

create index sport_events_starts_idx on public.sport_events (starts_at);

-- ---------------------------------------------------------------------
-- Poptávky (rezervace, pronájem prostor, oslavy)
-- Vkládá je pouze serverový endpoint (service role) po validaci.
-- ---------------------------------------------------------------------
create table public.inquiries (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('reservation', 'event')),
  name          text not null check (length(name) between 1 and 120),
  phone         text not null check (length(phone) between 5 and 40),
  email         text check (email is null or length(email) <= 200),
  event_date    date,
  event_time    text,
  guests        integer check (guests is null or guests between 1 and 1000),
  space         text,
  message       text check (message is null or length(message) <= 4000),
  status        text not null default 'new' check (status in ('new', 'handled')),
  email_notified boolean not null default false,
  ip_hash       text,
  created_at    timestamptz not null default now()
);

create index inquiries_created_idx on public.inquiries (created_at desc);
create index inquiries_ip_idx on public.inquiries (ip_hash, created_at desc);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.admin_users      enable row level security;
alter table public.site_settings    enable row level security;
alter table public.private_settings enable row level security;
alter table public.daily_menus      enable row level security;
alter table public.menu_email_log   enable row level security;
alter table public.menu_categories  enable row level security;
alter table public.menu_items       enable row level security;
alter table public.spaces           enable row level security;
alter table public.gallery_photos   enable row level security;
alter table public.sport_events     enable row level security;
alter table public.inquiries        enable row level security;

-- admin_users: uživatel vidí jen sebe; zápis pouze přes SQL editor / service role
create policy admin_users_select_self on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));

-- site_settings: čtou všichni, mění admin
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated using (true);
create policy site_settings_admin_update on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- private_settings: pouze admin
create policy private_settings_admin_read on public.private_settings
  for select to authenticated using (public.is_admin());
create policy private_settings_admin_update on public.private_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- daily_menus: veřejnost vidí pouze aktuálně zveřejněné menu, admin vše
create policy daily_menus_public_current on public.daily_menus
  for select to anon, authenticated using (is_current);
create policy daily_menus_admin_select on public.daily_menus
  for select to authenticated using (public.is_admin());
create policy daily_menus_admin_insert on public.daily_menus
  for insert to authenticated with check (public.is_admin() and not is_current);
create policy daily_menus_admin_update on public.daily_menus
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy daily_menus_admin_delete on public.daily_menus
  for delete to authenticated using (public.is_admin());

-- menu_email_log: pouze admin (bez mazání – log je auditní)
create policy menu_email_log_admin_select on public.menu_email_log
  for select to authenticated using (public.is_admin());
create policy menu_email_log_admin_insert on public.menu_email_log
  for insert to authenticated with check (public.is_admin());

-- veřejný obsah: čtou všichni viditelné, admin vše
create policy menu_categories_public_read on public.menu_categories
  for select to anon, authenticated using (is_visible or public.is_admin());
create policy menu_categories_admin_all on public.menu_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy menu_items_public_read on public.menu_items
  for select to anon, authenticated using (
    (is_visible and exists (
      select 1 from public.menu_categories c where c.id = category_id and c.is_visible
    )) or public.is_admin()
  );
create policy menu_items_admin_all on public.menu_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy spaces_public_read on public.spaces
  for select to anon, authenticated using (is_visible or public.is_admin());
create policy spaces_admin_all on public.spaces
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy gallery_public_read on public.gallery_photos
  for select to anon, authenticated using (is_visible or public.is_admin());
create policy gallery_admin_all on public.gallery_photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy sport_public_read on public.sport_events
  for select to anon, authenticated using (is_visible or public.is_admin());
create policy sport_admin_all on public.sport_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- inquiries: čte a mění jen admin, vkládá jen server (service role obchází RLS)
create policy inquiries_admin_select on public.inquiries
  for select to authenticated using (public.is_admin());
create policy inquiries_admin_update on public.inquiries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy inquiries_admin_delete on public.inquiries
  for delete to authenticated using (public.is_admin());

-- Explicitní omezení oprávnění anonymní role na zápis
revoke insert, update, delete, truncate on all tables in schema public from anon;
