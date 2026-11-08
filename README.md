# HomeOS – osobní a rodinná finanční centrála

Webová aplikace pro každodenní správu domácích financí: zůstatky a disponibilní peníze,
rodinný rozpočet, inteligentní rozpočet na jídlo, spoření a finanční plánovač,
pracovní příjmy (Rohlík na IČO), faktury s OCR, plánované nákupy, pravidelné platby,
finanční asistent a archiv dokumentů. Tmavý „glassy“ design se zlatými akcenty,
česky, s formáty data a měny Kč, pro mobil i desktop.

---

## Co je potřeba nastavit (a co funguje hned)

| Oblast | Stav |
|---|---|
| **Lokální vývojový režim** | Jen na vyžádání (`NEXT_PUBLIC_HOMEOS_LOCAL_MODE=1` v `.env.local`) – pro vývoj a testy. Místo Supabase ukládá data do `.data/homeos.json` a soubory do `.data/files/`. Přihlašování, všechny sekce, OCR, importy i zálohy fungují. |
| **Supabase** (databáze, přihlášení, úložiště) | **Nastaveno:** produkční projekt má spuštěné migrace a jeho veřejná adresa a anon klíč jsou výchozí hodnotou v `src/lib/env.ts`. Pro jiný projekt je přepíšou proměnné prostředí. |
| **Vercel** | Stačí napojit repozitář; proměnné prostředí jsou volitelné. Lokální režim se na Vercelu nikdy nespustí. |
| **OCR faktur** | Funguje v prohlížeči. PDF s textovou vrstvou se čtou přímo; fotky a skeny rozpoznává Tesseract (čeština + angličtina), jehož jazyková data se při prvním použití stáhnou z CDN jsDelivr. |
| **Bankovní synchronizace** | Záměrně **není** implementovaná – je jen připravené místo v Nastavení. Transakce se importují z CSV výpisu. |

Aplikace **nikdy nevymýšlí** vaše příjmy, výdaje, zůstatky ani dluhy. Vše zadáváte v úvodním
nastavení a v jednotlivých sekcích. Ukázková data existují jen v samostatné **DEMO domácnosti**
(viz [Demo data](#demo-data)).

---

## Funkce

- **Přehled** – disponibilní zůstatek, příjmy a výdaje měsíce, odloženo, zbývá do konce měsíce,
  skutečně volné peníze; 10 karet (stav financí, příjmy vs. výdaje, měsíční rozpočet, domácí
  výdaje, rozpočet na jídlo, spoření, pracovní příjmy, neuhrazené faktury, nadcházející platby,
  finanční cíle), graf vývoje zůstatku, měsíční graf, kategorie a doporučení asistenta.
- **Domácnost** – výdaje podle kategorií, kdo platil, společné vs. osobní, srovnání s minulým
  měsícem, správa kategorií (vlastní, archivace, označení „jídlo“ a „domácnost“).
- **Příjmy a výdaje** – všechny pohyby, filtry (měsíc, typ, kategorie, účet, člen, stav, text),
  převody mezi účty, účtenky v příloze, **storno a obnovení**, import CSV z banky s detekcí
  duplicit, export CSV.
- **Práce (Rohlík)** – směny (čas, špička, běžné/expresní trasy, objednávky, spropitné, bonusy,
  odměny, pronájem vozidla, vybavení, soukromé km, srážky), návrh výdělku podle sazeb,
  denní/týdenní/měsíční přehled, průměr na den a hodinu, graf, import a export CSV,
  **výplaty** (očekávání vs. skutečnost, rozdíl, stav).
- **Faktury** – vystavené/přijaté, nezaplacené, po splatnosti, zaplacené, stornované; PDF i fotky,
  **OCR s povinným potvrzením**, vyhledávání, filtry, přehled splatností, propojení úhrady
  s existující platbou (žádné dvojí započtení), export.
- **Nákupy** – plánuji / kupuji / koupeno, priorita, odkaz, seznam přání, **kontrola, zda si nákup
  můžete dovolit** (kolik chybí, kolik ušetřit, odkdy si ho lze bezpečně dovolit).
- **Cestování** – cesty (kam, kdy, kolik osob, rozpočet), trasa po úsecích (vlak, autobus, auto,
  letadlo, trajekt… s dopravcem, časy, cenou, kalkulačkou paliva) na mapě (OpenStreetMap) s odkazy
  na IDOS a mapy, výdaje i v cizí měně s kurzem ČNB, kolik lze utratit na místě za den, a po návratu
  souhrn s grafy – za co, po dnech, kde, podle měny, doprava – a přehled navštívených destinací.
  Dále: účastníci a vyrovnání (kdo komu dluží), hotovost v cizí měně (výměna se odečte jednou),
  program po dnech, seznam věcí k vyřízení a sbalení podle typu cesty, jízdenky a dokumenty u cesty,
  návrh plateb z banky k přiřazení, kopie cesty, srovnání cest, cíl ve Spoření pro cestu, rychlý zápis
  výdaje přes + a upozornění (den před odjezdem, překročení denního limitu – denní cron `/api/cron/daily`).
- **Spoření a plánovač** – cíle s termínem, automaticky spočítaný potřebný měsíční vklad,
  procento splnění, odhad data; plánovač počítá 5 výstupů (viz níže).
- **Rozpočty** – inteligentní rozpočet na jídlo (měsíc/týden/den, přepočet, tempo, upozornění),
  celkový limit, limity kategorií, výjimky pro konkrétní měsíc.
- **Pravidelné platby** – kalendář, frekvence, splatnosti, zaplacení termínu (každý jen jednou),
  „zaplaceno mimo evidenci“, přeskočení, dluhy se zbývající částkou, očekávané příjmy.
- **Finanční asistent** – doporučení z dat a otázky typu „Můžeme si dovolit koupit sedačku
  za 15 000 Kč?“. Deterministické výpočty, žádný jazykový model; když data chybí, doptá se.
- **Dokumenty** – soukromý archiv, druhy, štítky, vyhledávání i v rozpoznaném textu.
- **Nastavení** – členové, účty a hotovost, výchozí zůstatky, pravidelné příjmy, kategorie,
  rezerva, upozornění, fakturační údaje, práce, pozvánky dalších členů, import banky,
  export, **záloha a obnova**, změna hesla. Pole se ukládají automaticky.
- **Rychlé tlačítko +** – příjem, výdaj, faktura, nákup, pracovní směna, spoření.

---

## Přesnost výpočtů

Toto je nejdůležitější technická vlastnost aplikace.

- **Haléře, ne desetinná čísla.** Všechny částky jsou celé haléře (`bigint` v databázi,
  bezpečná celá čísla v TypeScriptu). Vstupy jako `1 234,50` se převádějí na `123450` bez
  `parseFloat`; nejednoznačné zápisy (`1,234`) se odmítnou. Dělení má explicitní zaokrouhlení:
  limity **dolů** (aplikace nikdy nenabídne víc, než je), potřebné vklady **nahoru**.
  Viz `src/lib/money.ts`.
- **Rozlišení pojmů** (`src/lib/finance/`):
  - *aktuální zůstatek* = výchozí zůstatek účtu + platné transakce od data výchozího zůstatku,
  - *disponibilní peníze* = běžné účty a hotovost − peníze odložené na cíle (spořicí účty se
    nepočítají),
  - *očekávané příjmy* (pravidelné příjmy, výplaty, vystavené faktury) se **nikdy** nepočítají
    jako dostupné – jen informativně,
  - *budoucí závazky* = nezaplacené termíny pravidelných plateb a přijaté faktury do konce měsíce,
  - *rezervované peníze* = cíle vyčleněné na běžném účtu + rezerva,
  - *skutečné úspory* = součet vkladů na cíle.
- **Nic se nezapočítá dvakrát.** Platba termínu, výplata, faktura, nákup i vklad mají vazbu na
  transakci s **unikátním indexem** v databázi (jeden zdroj = nejvýše jedna platná transakce).
  CSV importy mají otisk řádku, opakovaný import nic nezdvojí. Možné duplicity s ručně zadanými
  výdaji import předem odškrtne. Transakce starší než datum výchozího zůstatku se do zůstatku
  nepočítají. Převody nejsou příjem ani výdaj.
- **Storno a úpravy.** Storno transakci ponechá v historii, ale přestane ji započítávat; navázané
  záznamy (výplata, faktura, nákup, vklad) se vrátí do původního stavu. Všechny přehledy se
  počítají při každém zobrazení z databáze – po každé změně jsou automaticky správně.
- **Staré údaje nejsou aktuální.** Neuhrazené termíny starší než 45 dní se do plánu automaticky
  nepočítají a faktury vystavené před více než 60 dny se uloží jako „mimo plán“ (lze změnit).

### Plánovač (zbytek aktuálního měsíce)

```
disponibilní        = běžné účty + hotovost − odloženo na cíle (na běžných účtech)
závazky             = nezaplacené pravidelné platby + přijaté faktury do konce měsíce
musí zůstat         = odloženo na cíle + závazky + zbytek rozpočtu na jídlo
                      + zbytek limitů kategorií + bezpečnostní rezerva
1. musí zůstat na účtu
2. bezpečně utratit = max(0, disponibilní − (musí zůstat − odloženo) − plán spoření)
3. máme odložit     = zbývající plán spoření tento měsíc
4. potřebujeme vydělat = max(0, závazky + rozpočty + rezerva + plán spoření − disponibilní)
5. můžeme spořit    = max(0, disponibilní − závazky − rozpočty − rezerva)
```

### Rozpočet na jídlo

Pro měsíc s `D` dny, dnešní den `d`, rozpočet `B` a útratu `S` (včetně dneška):
denní plán `B/D`, týdenní `7B/D`, zbývá `B − S`, **přepočítaný denní limit** `(B − S)/(D − d + 1)`,
limit do konce týdne (po–ne, v rámci měsíce), průměr `S/d`, odhad `S + S/d·(D − d)`.
Upozornění: blížíte se k limitu (výchozí 85 %), překročení, utrácíte rychleji než plán
(o více než 10 %), při současném tempu peníze nevystačí. Příklad: 12 000 Kč v listopadu →
400 Kč/den, 2 800 Kč/týden; po útratě 4 000 Kč do 6. 11. zbývá 320 Kč/den.

---

## Technologie a architektura

| Vrstva | Volba |
|---|---|
| Aplikace | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Vzhled | Tailwind CSS 4, Framer Motion, Lucide ikony, Recharts (ověřená barevná paleta grafů) |
| Data | Supabase PostgreSQL s Row Level Security |
| Přihlášení | Supabase Auth (e-mail + heslo, potvrzení e-mailu, obnova hesla) |
| Soubory | Supabase Storage, soukromý bucket `documents` |
| OCR | `unpdf` (textová vrstva PDF) + `tesseract.js` (fotky a skeny) – v prohlížeči |
| Testy | Vitest (výpočty), PostgreSQL (migrace + RLS), Playwright (end-to-end) |

```
src/
  app/(auth)/        přihlášení, registrace, obnova hesla
  app/uvod/          úvodní nastavení (průvodce), pozvánka, demo
  app/(app)/         všechny sekce aplikace (serverové stránky)
  app/api/           soubory, exporty CSV, záloha JSON
  components/        UI (glass karty, formuláře, grafy, navigace, rychlé +)
  lib/money.ts       peněžní aritmetika v haléřích
  lib/dates.ts       data YYYY-MM-DD, časová zóna Europe/Prague
  lib/finance/       zůstatky, období, jídlo, cíle, plánovač, závazky, práce, dostupnost nákupu
  lib/assistant.ts   doporučení a odpovědi asistenta
  lib/actions/       serverové akce (validace zod, kontrola vlastnictví)
  lib/db/            jednotné rozhraní k datům: Supabase / lokální JSON
supabase/migrations/ schéma, RLS, úložiště
supabase/tests/      testy RLS
tests/               unit a end-to-end testy
```

**Datová vrstva.** Všechny stránky a akce pracují přes rozhraní `Store`
(`src/lib/db/store.ts`). V produkci jej implementuje Supabase klient **s relací uživatele**
(všechny dotazy procházejí RLS), v lokálním režimu JSON soubor, který napodobuje stejná pravidla:
unikátní klíče, vazby mezi tabulkami a přístup jen k vlastní domácnosti.

### Bezpečnost

- Žádný tajný klíč v prohlížeči. Aplikace používá veřejný `anon` klíč; service-role klíč je
  potřeba jen volitelně pro plánovaný týdenní souhrn (`/api/cron/weekly`) a denní upozornění k cestám (`/api/cron/daily`), obojí chráněno `CRON_SECRET`.
- **Oprávnění členů** se vynucují v databázi (RLS): připojený člen vidí vše, upravovat smí jen
  sekce, které mu vlastník povolí (výchozí plná práva).
- **Row Level Security** na všech tabulkách: uživatel vidí jen domácnosti, jichž je členem.
  Složené cizí klíče `(household_id, id)` znemožní odkaz na data jiné domácnosti.
- Úložiště: cesta souboru začíná `household_id`, politiky pouštějí jen členy domácnosti.
  Soubory se stahují přes `/api/files/[id]` po kontrole přístupu, s `nosniff` a sandbox CSP.
- Každá serverová akce znovu ověří přihlášení a vlastnictví všech odkazovaných záznamů
  a validuje vstupy (zod). Pozvánky do domácnosti přijímá bezpečná SQL funkce.
- Hlavičky: HSTS, `X-Frame-Options: DENY`, `noindex`, `Cache-Control: private, no-store`.

---

## Lokální spuštění

Požadavky: Node.js 20.9+.

```bash
npm install
npm run dev          # http://localhost:3000
```

Aplikace se ve výchozím stavu připojí k produkční databázi Supabase. Pro vývoj bez ní dejte do
`.env.local` řádek `NEXT_PUBLIC_HOMEOS_LOCAL_MODE=1` – pak běží **lokální režim** s daty ve
složce `.data/` (není v gitu).
Zapomenuté heslo v lokálním režimu: smažte `.data/homeos.json` (smaže i data) nebo se
přihlaste a heslo změňte v Nastavení.

### S vlastním Supabase

1. Vytvořte projekt na [supabase.com](https://supabase.com) (region EU, např. Frankfurt).
2. Spusťte migrace – buď v **SQL Editoru** postupně obsah souborů
   `supabase/migrations/20261106000100_schema.sql`, `…0200_security.sql`, `…0300_storage.sql`, `…0400_fix_member_select.sql`,
   nebo přes CLI:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. **Authentication → URL Configuration:** Site URL = adresa aplikace,
   Redirect URLs = `https://<vase-domena>/auth/confirm` (a `http://localhost:3000/auth/confirm`).
4. Do `.env.local` zkopírujte `.env.example` a vyplňte
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API)
   a `NEXT_PUBLIC_SITE_URL`.
5. `npm run dev`, zaregistrujte se a potvrďte e-mail.

---

## Nasazení na Vercel (produkce)

1. Na Vercelu **Add New → Project**, vyberte tento repozitář.
2. Root Directory nechte výchozí (kořen repozitáře). Framework se rozpozná jako Next.js;
   `vercel.json` nastavuje region `lhr1` (Londýn) – stejný jako databáze Supabase (eu-west-2), aby dotazy nečekaly na cestu přes Evropu.
3. **Environment Variables** (Production i Preview):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.
4. Deploy. V Supabase doplňte produkční adresu do Site URL a Redirect URLs (viz výše).
5. Kontrola po nasazení: registrace → potvrzovací e-mail → úvodní nastavení → přidat výdaj
   → nahrát účtenku → stáhnout zálohu v Nastavení.

Doporučení pro produkci: v Supabase zapněte zálohy databáze (Point-in-Time Recovery na placeném
plánu), nastavte vlastní SMTP pro e-maily (Auth → SMTP) a pravidelně stahujte zálohu
z Nastavení → Export a záloha. Na Vercelu má jeden požadavek limit 4,5 MB – soubory se proto
v produkci nahrávají z prohlížeče **přímo do Supabase Storage**; obnova zálohy včetně dokumentů
přes 4,5 MB je možná jen při vlastním hostingu nebo lokálně.

---

## Aplikace na iPhonu (PWA)

HomeOS lze přidat na plochu iPhonu a používat jako aplikaci (celá obrazovka, vlastní ikona):
Safari → otevřít adresu aplikace → tlačítko **Sdílet** → **Přidat na plochu** → **Přidat**.
Ikona (`src/app/apple-icon.png`) a manifest (`src/app/manifest.ts`) jsou připravené.

## Zálohování a obnova

- **Nastavení → Export a záloha → Záloha (JSON)** – kompletní data domácnosti; varianta
  „vč. dokumentů“ přibalí soubory (base64).
- **Obnova** (jen vlastník) nahradí data aktuální domácnosti obsahem zálohy. Identifikátory se
  přegenerují (lze obnovit i do jiné domácnosti), vazby se přemapují; při chybě se vrátí původní
  stav. Pro potvrzení je nutné napsat `OBNOVIT`.
- **CSV exporty** – transakce, faktury, směny, výplaty (UTF-8, středník – otevře se v Excelu).

## Import CSV

- **Banka** (Příjmy a výdaje → Import CSV z banky): kódování UTF-8 i Windows-1250 a oddělovač se
  rozpoznají automaticky; sloupce se namapují podle názvů (lze změnit), podporována je jedna
  částka se znaménkem i dva sloupce příjem/výdaj. Kategorie se navrhnou podle obchodníka.
- **Směny** (Práce → Import CSV): šablonu lze stáhnout přímo v dialogu importu.

## Demo data

Tlačítko „Vyzkoušet s ukázkovými daty“ (úvod) nebo „Vytvořit demo domácnost“ (Nastavení)
vytvoří **samostatnou domácnost** s příznakem `is_demo`, všechny názvy mají příponu „(demo)“
a celá aplikace v ní zobrazuje výrazný pruh DEMO. Se skutečnými financemi se nikdy nemíchá;
mezi domácnostmi se přepíná v levém panelu a demo lze kdykoli smazat.

---

## Testy

```bash
npm run check      # typecheck + lint + unit testy
npm test           # unit testy finančních výpočtů (money, data, jídlo, plánovač, cíle,
                   # snapshot bez dvojího započtení, OCR parser, CSV, asistent)
npm run test:db    # migrace + RLS na dočasném PostgreSQL (vyžaduje initdb/pg_ctl/psql)
npm run test:e2e   # production build + Chromium: registrace, průvodce, výdaj, storno,
                   # zaplacení platby, cíl, plánovač, nákup, asistent, faktura,
                   # OCR z PDF s povinným potvrzením, směna, výplata, exporty, záloha
                   # a obnova, všechny stránky, mobilní zobrazení, demo, izolace uživatelů
```

End-to-end test běží v lokálním režimu (bez Supabase) v dočasné složce; Chromium hledá v
`/opt/pw-browsers/chromium`, jinak nastavte `CHROMIUM_PATH`.

## Volitelné funkce (proměnné prostředí)

| Funkce | Proměnné | Bez nich |
|---|---|---|
| AI asistent v chatu (Claude: odpovídá na jakékoli otázky, čísla bere jen z vašich dat přes výpočty aplikace, výdaje zapíše až po potvrzení), AI odhad ceny potravin | `ANTHROPIC_API_KEY` | asistent odpovídá na rozpoznané typy otázek, ceny jen z vaší cenové paměti |
| Týdenní souhrn jako oznámení na telefon | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` | týdenní souhrn je vidět v sekci Finanční asistent |

AI nikdy nepočítá peníze: jen převede otázku na strukturovaný dotaz, čísla spočítá aplikace z
databáze. Odhad ceny potraviny je vždy označený „odhad AI – ověřte“. Ceny z kupi.cz se
automaticky nestahují – aplikace odkazuje na aktuální akce a pamatuje si ceny, které jste
skutečně zaplatili.

## Budoucí rozšíření

- Historie až 6 měsíců zpětně s podrobným logem změn (kdo co zadal nebo upravil).

- Bankovní synchronizace přes PSD2 API (místo je připravené v Nastavení → Banka).
- Push/e-mailová upozornění (nyní se upozornění zobrazují v aplikaci).
- Vystavování faktur do PDF z fakturačních údajů.
