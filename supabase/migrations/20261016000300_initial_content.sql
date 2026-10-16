-- =====================================================================
-- Výchozí obsah. Obsahuje jen ověřené údaje o podniku.
-- Otevírací doba, ceny, kapacity a položky lístku se záměrně
-- NEvyplňují – doplní je majitel v administraci.
-- =====================================================================

insert into public.site_settings (
  id, restaurant_name, phone, email,
  address_street, address_zip, address_city,
  opening_hours, services, texts
) values (
  1,
  'Restaurace Rybníky',
  '+420 602 163 330',
  'info@rybnickarestaurace.cz',
  'Rybníky 40', '263 01', 'Dobříš',
  '[]'::jsonb,
  '[
    {"key": "daily_menu",   "label": "Denní menu",              "enabled": true},
    {"key": "drinks",       "label": "Nápojový lístek",         "enabled": true},
    {"key": "beer_snacks",  "label": "Chuťovky k pivu",         "enabled": true},
    {"key": "sports",       "label": "Sportovní přenosy",       "enabled": true},
    {"key": "bar",          "label": "Hlavní výčep",            "enabled": true},
    {"key": "lounges",      "label": "Dva salonky",             "enabled": true},
    {"key": "hall",         "label": "Sál pro větší akce",      "enabled": true},
    {"key": "garden",       "label": "Venkovní zahrádka",       "enabled": true},
    {"key": "accessible",   "label": "Bezbariérový přístup",    "enabled": true},
    {"key": "kids",         "label": "Dětský koutek",           "enabled": true},
    {"key": "wifi",         "label": "Wi-Fi",                   "enabled": true},
    {"key": "takeaway",     "label": "Jídlo s sebou",           "enabled": true}
  ]'::jsonb,
  '{
    "hero_eyebrow": "Rybníky u Dobříše",
    "hero_title": "Restaurace Rybníky",
    "hero_subtitle": "Česká restaurace a hospoda s denním menu, točeným pivem, salonky, sálem pro oslavy a venkovní zahrádkou.",
    "about_title": "Hospoda, kam se rádi vracíte",
    "about_text": "Restaurace Rybníky je místo pro polední menu, večerní posezení u piva i rodinné oslavy. Kromě hlavního výčepu nabízíme dva salonky, sál pro větší akce a venkovní zahrádku.",
    "menu_note": "Denní menu zveřejňujeme každý den v tomto místě. Na jídlo s sebou se můžete předem domluvit telefonicky.",
    "spaces_intro": "Pro posezení s přáteli, firemní akci, svatbu nebo rodinnou oslavu. Rádi s vámi domluvíme podrobnosti.",
    "sport_intro": "Sledujte s námi zápasy a závody v příjemné hospodské atmosféře.",
    "contact_note": "Rezervace stolů a poptávky akcí vyřídíme nejrychleji telefonicky."
  }'::jsonb
) on conflict (id) do nothing;

insert into public.private_settings (id) values (1) on conflict (id) do nothing;

insert into public.spaces (slug, name, description, sort_order) values
  ('vycep',    'Hlavní výčep',      'Srdce hospody – posezení u točeného piva, chuťovky a sportovní přenosy.', 10),
  ('salonek-1','Salonek',           'Oddělený prostor pro menší společnost, schůzky nebo rodinná setkání.',     20),
  ('salonek-2','Druhý salonek',     'Další samostatný salonek pro soukromé posezení.',                         30),
  ('sal',      'Sál',               'Prostor pro větší akce – oslavy, svatby, firemní večírky a setkání.',     40),
  ('zahradka', 'Venkovní zahrádka', 'Posezení venku za hezkého počasí.',                                       50)
on conflict (slug) do nothing;

insert into public.menu_categories (kind, name, sort_order) values
  ('food',  'Polévky',          10),
  ('food',  'Hlavní jídla',     20),
  ('food',  'Chuťovky k pivu',  30),
  ('food',  'Dezerty',          40),
  ('drink', 'Pivo',             10),
  ('drink', 'Nealkoholické nápoje', 20),
  ('drink', 'Teplé nápoje',     30),
  ('drink', 'Víno',             40),
  ('drink', 'Destiláty',        50);
