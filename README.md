# Restaurace Rybníky – web a administrace denního menu

Nový web Restaurace Rybníky (Rybníky 40, 263 01 Dobříš) s administrací, ve které majitel
každý den nahraje PNG s menu, zveřejní ho jedním kliknutím a systém ho automaticky
odešle e-mailem k tisku.

- **Veřejný web:** úvod, denní menu, jídelní a nápojový lístek, prostory a akce,
  sportovní přenosy, fotogalerie, kontakt s mapou, rezervace / poptávka akce.
- **Administrace `/admin`:** denní menu (nahrání, historie, opakované odeslání,
  znovuzveřejnění, mazání), otevírací doba, kontakt, texty, služby, lístek a ceny,
  prostory, sportovní přenosy, fotografie, logo, příjemci e-mailů, poptávky.
- **Návod pro majitele:** [`docs/NAVOD-PRO-MAJITELE.md`](docs/NAVOD-PRO-MAJITELE.md)

---

## Co je potřeba doplnit před spuštěním

| Co | Proč | Kde |
|---|---|---|
| **Originální logo** | Původní web nebyl během vývoje z prostředí dostupný, logo se nepodařilo stáhnout. Žádné náhradní logo nebylo vytvořeno – do nahrání se zobrazuje jen název písmem. | Administrace → Nastavení → Logo (SVG/PNG se uloží beze změny), nebo soubor do `public/brand/` + `NEXT_PUBLIC_LOGO_PATH` |
| Favicon z loga | `src/app/icon.svg` je dočasná neutrální ikona. | nahradit souborem vytvořeným z originálního loga |
| Fotografie | Na web nebyly použity cizí ani ilustrační fotky. Bez fotek web používá barevné pozadí. | Administrace → Fotografie, Nastavení → Úvodní fotografie |
| Otevírací doba, ceny, kapacity prostor | Neověřené údaje se nevymýšlely. Prázdná pole se na webu nezobrazují. | Administrace |
| Údaje provozovatele (IČO) | doplnit do stránky Ochrana osobních údajů | `src/app/(site)/ochrana-udaju/page.tsx` |
| Přístupy k Supabase a Resend | viz níže | `.env` |

Služby (výčep, dva salonky, sál, zahrádka, bezbariérovost, dětský koutek, Wi-Fi,
jídlo s sebou, sport…) jsou předvyplněné podle zadání; v administraci je lze
vypnout, pokud už neplatí.

---

## Technologie

| Vrstva | Volba |
|---|---|
| Frontend + server | **Next.js 16** (App Router, React 19, TypeScript), Tailwind CSS 4 |
| Databáze | **Supabase Postgres** s Row Level Security |
| Soubory | **Supabase Storage** (bucket `menus` pro PNG, `media` pro fotky a logo) |
| Přihlášení | **Supabase Auth** (e-mail + heslo, registrace vypnutá) |
| E-maily | **Resend** (odesílání pouze ze serveru) |
| Hosting | doporučeno **Vercel** (funguje i libovolný Node.js hosting) |

Písma (Fraunces, Inter) jsou hostovaná lokálně přes `@fontsource` – žádné volání Google Fonts.

### Architektura denního menu

```
Prohlížeč majitele                         Server (Next.js)                   Supabase / Resend
───────────────────                         ────────────────                   ─────────────────
1. výběr PNG → kontrola signatury,
   rozměrů a velikosti, náhled
2. upload do Storage (bucket menus) ─────────────────────────────────────────▶ RLS: jen admin, jen PNG ≤ 15 MB
3. POST /api/admin/menus ──────────────▶ ověří admina (Auth + admin_users)
                                         stáhne soubor, znovu ověří PNG,
                                         spočítá SHA-256
                                         INSERT daily_menus  ─────────────────▶ historie
                                         RPC publish_menu (atomicky) ─────────▶ is_current přepnut
                                         revalidace veřejného webu
                                         RPC claim_menu_email (zámek) ────────▶ pending → sending
                                         Resend + PNG příloha (originál) ─────▶ ID zprávy
                                         stav sent / failed + log ────────────▶ menu_email_log
4. výsledek: zveřejněno ✓, e-mail ✓/⚠
```

- **Zveřejnění nikdy nezávisí na e-mailu.** Selže-li Resend, menu je zveřejněné,
  stav je `failed`, chyba je v logu a v administraci je tlačítko „Zkusit znovu“.
- **Stav „odesláno“** se zapíše až po vrácení ID zprávy od Resend.
- **Dvojí odeslání:** funkce `claim_menu_email` menu atomicky zamkne; souběžné
  požadavky, dvojklik ani obnovení stránky nic znovu nepošlou. Již odeslané menu
  se pošle znovu jen po výslovném potvrzení (`force`). Každý pokus má vlastní
  `Idempotency-Key` pro Resend.
- **Zaseknutý stav** „sending“ (např. pád serveru) se po 5 minutách uvolní.
- **Historie** se nikdy nemaže automaticky; mazání je jen ruční s potvrzením.
- **Časové pásmo:** „dnes“, otevírací doba a časy přenosů se počítají v
  `Europe/Prague` (server na Vercelu běží v UTC). Veřejná stránka si „dnešek“
  ověří i v prohlížeči, protože HTML může pocházet z cache.
- **Automatická aktualizace:** po zveřejnění se veřejné stránky revalidují; otevřená
  stránka se navíc sama obnoví (kontrola `/api/menu/current` každou minutu).

### Struktura

```
src/
  app/
    (site)/            veřejné stránky (úvod, denni-menu, jidelni-listek, …)
    (print)/           /denni-menu/tisk – samostatná stránka pro tisk
    admin/             administrace (prihlaseni, obnova-hesla, (panel)/…)
      actions.ts       server actions (nastavení, lístek, prostory, sport, galerie)
    api/
      admin/menus/     zveřejnění, e-mail, znovuzveřejnění, mazání menu
      menu/current     veřejný stav aktuálního menu
      inquiry          veřejný formulář rezervace / poptávky
    auth/confirm       ověření odkazu pro obnovu hesla
    sitemap.ts, robots.ts, icon.svg
  components/          komponenty webu a administrace
  lib/                 data, e-mail, validace PNG, čas (Europe/Prague), Supabase klienti
  proxy.ts             obnovení relace a ochrana /admin (Next.js 16 „proxy“)
supabase/
  migrations/          SQL schéma, RLS, storage, výchozí obsah
  tests/               testy RLS proti PostgreSQL
tests/
  unit/                Vitest
  e2e/                 Playwright + lokální mock Supabase/Resend
docs/NAVOD-PRO-MAJITELE.md
```

---

## Instalace a spuštění

### 1. Supabase

1. Vytvořte projekt na <https://supabase.com> (region EU, např. Frankfurt).
2. Spusťte migrace – buď v **SQL Editoru** postupně vložte soubory
   `supabase/migrations/*.sql` (v pořadí podle názvu), nebo přes CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-projektu>
   npx supabase db push
   ```
   Migrace vytvoří tabulky, RLS pravidla, funkce `publish_menu` a
   `claim_menu_email`, buckety `menus` a `media` s pravidly a výchozí obsah.
3. **Vypněte registraci:** Authentication → Sign In / Providers → Email →
   vypnout „Allow new users to sign up“.
4. **Vytvořte účet majitele:** Authentication → Users → *Add user* (e-mail + silné
   heslo, „Auto confirm“). Potom v SQL Editoru:
   ```sql
   insert into public.admin_users (user_id, note)
   select id, 'majitel' from auth.users where email = 'majitel@example.cz';
   ```
   Bez tohoto záznamu se uživatel sice přihlásí, ale nemá žádná práva.
5. **URL pro obnovu hesla:** Authentication → URL Configuration → Site URL
   `https://www.rybnickarestaurace.cz`, Redirect URLs přidat
   `https://www.rybnickarestaurace.cz/auth/confirm`.
   V Authentication → Email Templates → *Reset password* použijte odkaz:
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/admin/obnova-hesla
   ```
6. Klíče najdete v Project Settings → API: URL, `anon`/publishable klíč a
   `service_role`/secret klíč.

### 2. Resend

1. Účet na <https://resend.com>, **Domains → Add domain** `rybnickarestaurace.cz`
   a u správce DNS doplňte zobrazené záznamy (SPF, DKIM). Počkejte na „Verified“.
2. **API Keys → Create** (Sending access) → `RESEND_API_KEY`.
3. `EMAIL_FROM`, např. `Restaurace Rybníky <menu@rybnickarestaurace.cz>`.

Bez nastaveného Resend web i zveřejňování menu fungují, e-mail se jen označí jako
neodeslaný s vysvětlením.

### 3. Lokální vývoj

```bash
cp .env.example .env.local   # a vyplnit
npm install
npm run dev                  # http://localhost:3000, administrace na /admin
```

### 4. Nasazení na Vercel

1. Repozitář importujte ve Vercelu (framework se rozpozná automaticky).
2. V Settings → Environment Variables nastavte proměnné z `.env.example`
   (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `IP_HASH_SALT` jsou tajné).
3. Deploy, poté v Settings → Domains připojte `www.rybnickarestaurace.cz`.
4. Po nasazení: přihlásit se na `/admin`, nahrát logo, vyplnit otevírací dobu
   a nahrát první menu.

Endpointy pro zveřejnění mají `maxDuration = 60 s` (odeslání přílohy).
PNG se nahrává z prohlížeče přímo do Supabase Storage, takže limit velikosti
těla požadavku na Vercelu (4,5 MB) se na menu nevztahuje (limit menu je 15 MB).

---

## Bezpečnost

- **Tři vrstvy ochrany administrace:** `proxy.ts` (přesměrování bez relace),
  `requireAdmin()` v každé stránce, akci a API (ověření přes Supabase Auth +
  tabulka `admin_users`) a **RLS v databázi i ve Storage**.
- Veřejnost čte jen viditelný obsah a **pouze aktuální menu**; nemůže nic vkládat,
  měnit ani mazat (ani přes přímé volání Supabase API s veřejným klíčem).
- Funkce `publish_menu` a `claim_menu_email` jsou `security definer` a samy
  kontrolují roli admina.
- PNG se ověřuje třikrát: v prohlížeči, pravidly bucketu (MIME + 15 MB) a na
  serveru podle skutečného obsahu (signatura, IHDR, rozměry). Neplatný soubor se
  z úložiště smaže.
- Tajné klíče (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`) jsou pouze na
  serveru (`server-only`). Service role se používá jen pro uložení veřejné poptávky.
- API administrace kontroluje `Origin` (CSRF), formulář poptávky má honeypot a
  limit 5 poptávek za hodinu z jedné (hashované) IP adresy.
- Hlavičky: HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `noindex` pro `/admin`.
- Mapa Google se načte až po kliknutí (žádné cookies třetích stran předem).

---

## Testy

```bash
npm run lint && npm run typecheck
npm test              # jednotkové testy (Vitest): PNG, čas Europe/Prague, e-mail, validace
npm run test:db       # migrace + RLS proti dočasnému PostgreSQL (initdb, bez Dockeru)
npm run test:e2e      # build + Playwright proti lokálnímu mocku Supabase a Resend
```

`test:e2e` (34 kontrol) projde v Chromiu celý tok: ochranu `/admin` a API,
odmítnutí neplatného PNG, nahrání → zveřejnění → e-mail s originálním PNG
(porovnání bajt po bajtu), neodeslání při obnovení stránky, výpadek e-mailové
služby (menu zůstane zveřejněné, stav „selhalo“), opakované odeslání, historii,
znovuzveřejnění, mazání, změnu příjemce, otevírací dobu, lístek, sport, poptávku,
mobilní zobrazení a funkčnost interních odkazů. Snímky obrazovky ukládá do `test-results/`.

> Mock v `tests/e2e/mock-backend.mjs` napodobuje Supabase jen zjednodušeně.
> Skutečná RLS pravidla ověřuje `npm run test:db` proti PostgreSQL. Ostrý provoz
> s Supabase a Resend je potřeba po nasazení ověřit nahráním prvního menu.

---

## SEO

- Titulky a popisy pro každou stránku (restaurace Rybníky Dobříš, denní menu
  Rybníky, pronájem sálu Rybníky, …), kanonické URL, Open Graph (`public/og-image.png`,
  případně úvodní fotografie).
- `sitemap.xml`, `robots.txt` (administrace a API vyloučeny).
- Strukturovaná data `schema.org/Restaurant` – jen skutečně vyplněné údaje
  (otevírací doba se doplní po zadání v administraci).
- Statické generování s revalidací (ISR 5 min + okamžitá revalidace po každé změně),
  optimalizace fotek přes `next/image` (AVIF/WebP), fotky se před nahráním zmenšují.
- Konkrétní pozice ve vyhledávačích nelze zaručit; doporučujeme založit / převzít
  profil Firmy.cz a Google Business se stejnými údaji.
