/**
 * Znalostní báze finančního asistenta (funguje bez AI). Každé téma má skupiny klíčových slov:
 * skupiny oddělené „;“ musí v otázce být všechny, varianty uvnitř skupiny oddělené „|“ stačí jedna.
 * Slova se porovnávají bez diakritiky a jako začátky slov (kořeny), takže pokryjí různé tvary a formulace.
 * U částek, které se mění (dávky, limity, daně), odkazujeme na ověření – asistent si čísla nevymýšlí.
 */
export interface KbEntry { k: string; a: string; href?: string; label?: string }

export const KB: KbEntry[] = [
  // ---------------- Jak na aplikaci ----------------
  { k: "zapsa|zapis|prida|zada|vloz|evid|zaznamen|dat do|ulozi ; vydaj|utratil|utrat|nakup|platb|zaplatil|uctenk", a: "Výdaj zapíšete tlačítkem + (Přidat) → Přidat výdaj. Rychleji to jde i tady v chatu – napište třeba „250 Albert“ a potvrďte.", href: "/transakce", label: "Příjmy a výdaje" },
  { k: "zapsa|prida|zada|zapis|evid|zaznamen|ulozi ; prijem|prijm|vyplat|mzd|duchod|vyzivn|davk", a: "Příjem zapíšete tlačítkem + → Přidat příjem. Pravidelné příjmy (mzda, důchod, výživné) nastavte v Nastavení → Příjmy – aplikace pak ohlídá, jestli přišly.", href: "/nastaveni#prijmy", label: "Pravidelné příjmy" },
  { k: "prevod|presun|preved ; ucet|ucty|uctu|hotovost|sporic", a: "Převod mezi vlastními účty zapíšete přes + → Přidat výdaj a nahoře zvolíte Převod. Převod se nepočítá jako výdaj ani příjem.", href: "/transakce" },
  { k: "prida|zaloz|novy ; ucet|hotovost|sporici ucet", a: "Účty a hotovost přidáte v Nastavení → Účty. Zadejte aktuální zůstatek k dnešnímu dni; spořicí účty se nepočítají do volných peněz.", href: "/nastaveni#ucty", label: "Účty" },
  { k: "zustatek|stav uctu ; nesedi|spatne|oprav|jiny|neodpovida", a: "Když zůstatek nesedí, porovnejte s bankou a buď doplňte chybějící pohyby, nebo v Nastavení → Účty upravte počáteční zůstatek a jeho datum. Pohyby před tímto datem se do zůstatku nepočítají.", href: "/nastaveni#ucty" },
  { k: "rozpocet ; jidl|potravin|nakup", a: "Rozpočet na jídlo nastavíte v Rozpočtech. Aplikace ho rozpočítá na týdny a dny a hlídá tempo – v Přehledu uvidíte, kolik můžete dnes utratit.", href: "/rozpocty", label: "Rozpočty" },
  { k: "rozpocet ; kategori|restaurac|zabav|limit", a: "Limity pro jednotlivé kategorie (restaurace, zábava…) nastavíte v Rozpočtech → Rozpočty kategorií.", href: "/rozpocty" },
  { k: "kategori ; prida|vytvor|nova|uprav|smaz|prejmenovat", a: "Kategorie spravujete v Nastavení → Kategorie. U výdajů pak vybíráte kategorii a uvidíte, kam peníze jdou.", href: "/nastaveni#kategorie" },
  { k: "pravideln|opakovan|trval ; platb|najem|predplatn|inkas|energi", a: "Pravidelné platby (nájem, energie, předplatné) přidáte v sekci Pravidelné platby. Aplikace ukáže, co je splatné, a odečte to z volných peněz. Po zaplacení klikněte na Zaplaceno.", href: "/platby", label: "Pravidelné platby" },
  { k: "cil|sporeni|usetrit na|odkladat ; zaloz|vytvor|novy|nastav", a: "Spořicí cíl založíte ve Spoření – zadáte částku a termín a aplikace spočítá, kolik odkládat měsíčně.", href: "/sporeni", label: "Spoření" },
  { k: "vklad|odlozit|odlozeni ; cil|sporeni", a: "Vklad na cíl zapíšete tlačítkem + → Přidat spoření (nebo u cíle ve Spoření). Odložené peníze se pak nepočítají do volných.", href: "/sporeni" },
  { k: "ico|podnik|osvc|zivnost ; aktiv|zada|nastav|zmen", a: "IČO aktivujete v Nastavení → IČO. Ověří se v registru ARES a zpřístupní se sekce Faktury. IČO lze měnit nejvýše jednou za 30 dní a s heslem.", href: "/nastaveni#ico", label: "IČO" },
  { k: "faktur ; vystav|prida|zapsa|nova|zada", a: "Fakturu přidáte v sekci Faktury (potřebuje aktivní IČO). Vystavené faktury se počítají jako očekávaný příjem, přijaté jako závazek.", href: "/faktury", label: "Faktury" },
  { k: "faktur|uctenk ; foto|vyfot|nacist|nacti|prect|precist|ocr|sken", a: "Nahrajte fotku nebo PDF faktury – údaje se rozpoznají a vy je jen zkontrolujete (v Premium). Účtenky z cest čte i formulář výdaje na cestě.", href: "/faktury" },
  { k: "faktur ; splatnost|po splatnost|nezaplacen|upomin", a: "Faktury po splatnosti uvidíte v Přehledu a ve Fakturách. U odběratele, který nezaplatil, pošlete upomínku a případně si v aplikaci posuňte očekávaný příjem.", href: "/faktury" },
  { k: "smen|prace|brigad ; zapsa|prida|nova|evid", a: "Směnu nebo odpracované hodiny zapíšete v sekci Práce (nebo + → Přidat pracovní směnu). Nejdřív nastavte, kde pracujete a jaký typ práce děláte.", href: "/prace", label: "Práce" },
  { k: "vyplat ; ocekavan|prisla|neprisla|zapsa", a: "Očekávanou výplatu zadejte v Práce → Výplaty. Do volných peněz se počítá až po potvrzení, že přišla – nic se nezapočte dvakrát.", href: "/prace?tab=vyplaty" },
  { k: "nakupni seznam|seznam ; vytvor|novy|prida|jak", a: "Nákupní seznam vytvoříte v Plánování. U položek uvidíte odhad ceny a jestli se nákup vejde do rozpočtu na jídlo. Po nákupu stačí zadat částku z účtenky.", href: "/planovani", label: "Plánování" },
  { k: "letak|akce|sleva ; obchod|lidl|albert|kaufland|billa|penny", a: "Akční letáky obchodů najdete v Plánování → Nákup jídla (odkazy na kupi.cz). U položek seznamu je i rychlé hledání ceny.", href: "/planovani" },
  { k: "nabytek|vybaven|domacnost ; planova|koup|prida", a: "Nábytek a vybavení naplánujete v Plánování → Nábytek a vybavení. Vložte odkaz na produkt – načte se fotka a cena – a uvidíte, kdy si to můžete dovolit.", href: "/planovani?tab=domov" },
  { k: "muzeme si dovolit|muzu si dovolit|dovolit si|koupit si", a: "Napište mi třeba „Můžeme si dovolit pračku za 9 990 Kč?“ – spočítám to z volných peněz a řeknu, odkdy by to šlo." },
  { k: "cest|dovolen|vylet ; zaloz|naplanova|nova|prida", a: "Cestu naplánujete v sekci Cestování (Premium): trasa, doprava, rozpočet na místě, výdaje i v cizí měně, kdo komu dluží a seznam věcí s sebou.", href: "/cestovani", label: "Cestování" },
  { k: "cizi men|eur|hotovost ; cest|zahranici|smenar|bankomat", a: "V cestě zapište výměnu nebo výběr z bankomatu (Hotovost v cizí měně). Z účtu se odečte jednou a hotovostní platby pak jdou z peněženky podle kurzu výměny." , href: "/cestovani" },
  { k: "vyrovnani|kdo komu|dluzi ; cest|kamarad|ucastnik", a: "V cestě přidejte účastníky a u výdajů vyberte, kdo platil a za koho. Aplikace spočítá vyrovnání s nejmenším počtem převodů a ukáže QR platbu.", href: "/cestovani" },
  { k: "recept ; najit|hledat|fitness|zdrav|levn|kuchyn", a: "V Receptech je 176 jídel (přes 1 000 variant) z 10 kuchyní rozdělených do kategorií – s kaloriemi, makry a cenou porce. Recepty můžete lajkovat, ukládat (ikonka záložky), přidávat vlastní recepty s fotkou (Premium), sestavit si jídelníček na týden a suroviny přidat jedním klikem do nákupního seznamu.", href: "/recepty", label: "Recepty" },
  { k: "import|nahra ; banka|vypis|csv|airbank|air bank|fio|csob|kb|moneta", a: "Výpis z internetového bankovnictví exportujte jako CSV a nahrajte v Nastavení → Banka. Duplicity se rozpoznají, opakovaný import nic nezdvojí.", href: "/nastaveni#banka", label: "Import z banky" },
  { k: "propoj|napoj|automatick ; banka|ucet|airbank|air bank", a: "Přímé napojení na banku zatím nejde – české banky ho poskytují jen licencovaným firmám. Nejrychlejší je pravidelně nahrát výpis CSV (Nastavení → Banka).", href: "/nastaveni#banka" },
  { k: "export|zaloha|stahn ; data|excel|csv", a: "Export do CSV (Excel) a kompletní zálohu najdete v Nastavení → Export a záloha.", href: "/nastaveni#zaloha" },
  { k: "obnov|nahra ; zaloh", a: "Zálohu obnovíte v Nastavení → Export a záloha → Obnovit ze zálohy (napíšete OBNOVIT). Současná data se nahradí.", href: "/nastaveni#zaloha" },
  { k: "pozv|prida|sdil ; partner|manzel|clen|rodin|domacnost", a: "V Nastavení → Domácnost vytvořte pozvánku a pošlete kód. Druhý ho zadá ve svém Nastavení a uvidíte stejná data.", href: "/nastaveni#domacnost", label: "Pozvánka" },
  { k: "opravneni|jen cist|nesmi upravovat|prava", a: "Vlastník domácnosti nastaví v Nastavení → Členové, které sekce smí člen upravovat a které jen vidět.", href: "/nastaveni#clenove" },
  { k: "opust|odej|odpoj ; domacnost", a: "Domácnost opustíte v Nastavení → Domácnost → Opustit domácnost. Vlastník může člena také odebrat.", href: "/nastaveni#domacnost" },
  { k: "reset|vynul|smazat vse|zacit znovu", a: "Domácnost vynulujete v Nastavení → Domácnost → Resetovat (vyberete části, potvrdíte heslem). Tovární reset vrátí domácnost do stavu po založení.", href: "/nastaveni#domacnost" },
  { k: "smaz|zrus ; ucet|registrac", a: "Účet smažete v Nastavení → Účet → Smazat účet. Domácnosti, kde jste jediný člen, se smažou i s daty; placené předplatné se zruší.", href: "/nastaveni#ucet" },
  { k: "zmen|zapomnel|nove ; heslo", a: "Heslo změníte v Nastavení → Účet. Zapomenuté heslo obnovíte na přihlašovací stránce odkazem Zapomenuté heslo.", href: "/nastaveni#ucet" },
  { k: "vzhled|barv|pozadi|tmav|motiv", a: "Barvy, pozadí a další vzhled nastavíte v Nastavení → Vzhled (všechny možnosti v Premium).", href: "/nastaveni#vzhled" },
  { k: "skry|schova|vypn|zobraz ; sekc|menu|faktur", a: "Sekce, které nepotřebujete, skryjete v Nastavení → Moje situace a sekce. Stačí zvolit svou situaci (student, senior…) nebo sekce vypnout ručně.", href: "/nastaveni#situace" },
  { k: "premium ; cena|stoji|kolik|co obsahuje|co umi|vyhod", a: "Premium stojí 49 Kč měsíčně nebo 449 Kč ročně. Přidává AI asistenta, čtení účtenek, cestování, všechny recepty, upozornění, neomezeně členů a celý vzhled. Prvních 3 dní je zdarma.", href: "/premium", label: "Premium" },
  { k: "zkusebni|zdarma|trial ; premium|3 dny|tri dny", a: "Premium vyzkoušíte 3 dny zdarma (jednou na osobu). Kartu zadáte předem, strhne se až po 3 dnech – když předtím zrušíte, neplatíte nic.", href: "/premium" },
  { k: "zrus|ukonc|odhlas ; predplatn|premium", a: "Předplatné zrušíte na stránce Premium → Spravovat předplatné. Premium vám zůstane do konce zaplaceného období.", href: "/premium" },
  { k: "upozorneni|notifikac|pripominky ; telefon|mobil|zapn", a: "Upozornění na telefon zapnete v Nastavení → Rezerva a upozornění (Premium). Na iPhonu nejdřív přidejte HomeOS na plochu.", href: "/nastaveni#planovani" },
  { k: "iphone|ios|android|aplikac|plochu ; nainstal|stahn|prida", a: "HomeOS je webová aplikace: na iPhonu otevřete v Safari → Sdílet → Přidat na plochu; na Androidu v Chromu → menu → Přidat na plochu. Pak funguje jako aplikace, i offline." },
  { k: "offline|bez signalu|bez internetu", a: "Bez signálu aplikace otevře naposledy zobrazené stránky a výdaje zapsané offline se odešlou, jakmile budete online." },
  { k: "demo|ukazkov", a: "Ukázková (DEMO) domácnost má vymyšlená data na vyzkoušení. Je úplně oddělená od vašich skutečných financí; přepnete se v menu nahoře.", href: "/nastaveni#domacnost" },
  { k: "uzaverk|souhrn mesic|jak jsme dopadli", a: "Měsíční uzávěrka ukáže, jak jste v měsíci dopadli: příjmy, výdaje, co narostlo a kolik jste odložili (Premium).", href: "/uzaverka", label: "Uzávěrka" },
  { k: "jednoduch|podrobn ; prehled|zobrazeni", a: "Přehled má dva režimy – Jednoduchý (jedna jasná odpověď a pár čísel) a Podrobný (všechny ukazatele). Přepínač je nahoře v Přehledu.", href: "/" },
  { k: "volne k utraceni|bezpecne k utraceni|kolik muzu utratit|skutecne volne", a: "„Volné k utracení“ je částka, kterou můžete utratit navíc, aniž byste ohrozili důležité: už je odečteno, co tento měsíc zaplatíte, zbytek rozpočtů, rezerva, plán spoření a cesty. Očekávané příjmy se nepočítají, dokud nepřijdou.", href: "/sporeni" },
  { k: "disponibilni|na uctech mame|kolik mame", a: "Disponibilní = peníze na běžných účtech a v hotovosti mínus to, co máte odložené na cíle. Spořicí účty sem nepatří." },
  { k: "ocekavan ; prijem|vyplat", a: "Očekávané příjmy (výplata, faktura) ukazujeme zvlášť a do volných peněz je nepočítáme, dokud skutečně nepřijdou – abyste neutratili peníze, které ještě nemáte." },
  { k: "bezpecnostni rezerv|rezerva v aplikaci|rezervu v aplikaci", a: "Bezpečnostní rezerva je částka, která má na účtu vždy zůstat pro nečekané výdaje. Nastavíte ji v Nastavení → Rezerva a upozornění; odečítá se z volných peněz.", href: "/nastaveni#planovani" },
  // ---------------- Rozpočet a spoření ----------------
  { k: "50/30/20|50 30 20|pravidlo rozpoct", a: "Pravidlo 50/30/20: zhruba 50 % příjmů na nutné výdaje (bydlení, jídlo, energie), 30 % na to, co chcete, a 20 % na spoření a splácení dluhů. Je to orientační vodítko, ne zákon." },
  { k: "jak|kde|tipy|rady ; usetr|setr|uspor", a: "Nejvíc obvykle pomůže: 1) projít předplatná a zrušit nepoužívaná, 2) rozpočet na jídlo s nákupním seznamem, 3) srovnat tarify energií, mobilu a pojištění, 4) odkládat hned po výplatě. Napište „Kde můžeme ušetřit?“ a projdu vaše skutečná data." },
  { k: "nouzov|rezervn|financni polstar|rezerv ; kolik|jak velk|mit|potrebuj|doporuc", a: "Doporučuje se mít rezervu na 3–6 měsíců nutných výdajů, u nepravidelných příjmů (OSVČ, brigády) spíš 6 a víc. Držte ji na spořicím účtu, kde je hned dostupná." },
  { k: "setr|usetr ; jidl|potravin|nakup", a: "Na jídle ušetříte: plánem jídel na týden a nákupním seznamem, nakupováním podle letáků, vařením do zásoby (meal prep), méně hotových jídel a nakupováním bez hladu. V Receptech uvidíte cenu porce." },
  { k: "setr|usetr|sniz ; energi|elektrin|plyn|topen", a: "Úspory energií: o 1 °C nižší teplota ušetří kolem 6 % za topení, větrat krátce a intenzivně, LED žárovky, pračka na plnou náplň a nižší teplotu, nechat si porovnat tarif dodavatele (srovnávače, ERÚ)." },
  { k: "setr|levnejsi|sniz ; mobil|tarif|internet|telefon", a: "U mobilu a internetu se vyplatí jednou ročně porovnat tarify a říct operátorovi o lepší nabídku – často ji dostanete. Zkontrolujte i dražší služby a pojištění telefonu, které nepotřebujete." },
  { k: "predplatn ; zrus|kolik|prehled|netflix|spotify", a: "Předplatná zadejte do Pravidelných plateb – uvidíte, kolik dohromady stojí za rok. Asistent upozorní i na opakované platby, které v plánu nemáte („Je v našich výdajích něco neobvyklého?“).", href: "/platby" },
  { k: "spontann|impulziv ; nakup|utracim", a: "Proti impulzivním nákupům pomáhá pravidlo 48 hodin: věc si dejte do Nákupů jako přání a vraťte se k ní za dva dny. Aplikace ukáže, jestli si ji opravdu můžete dovolit.", href: "/nakupy" },
  { k: "obalkov|obalky ; metod|system", a: "Obálková metoda = každé kategorii dáte předem pevnou částku a když dojde, víc neutrácíte. V aplikaci to odpovídá rozpočtům kategorií." },
  { k: "zac|jak zacit ; spor|setr|financ", a: "Začněte jednoduše: 1) zapisujte výdaje měsíc, 2) nastavte rozpočet na jídlo, 3) založte malou rezervu, 4) automaticky odkládejte pevnou částku hned po výplatě – i 500 Kč měsíčně." },
  { k: "sporici ucet|termin|terminovan ; rozdil|lepsi|vyplati", a: "Spořicí účet = peníze kdykoli k dispozici, úrok se může měnit. Termínovaný vklad = peníze vázané na dobu, za to někdy vyšší pevný úrok. Na rezervu spořicí účet, na peníze, které nebudete roky potřebovat, spíš investice." },
  { k: "stavebn ; sporen", a: "Stavební spoření má státní podporu (aktuálně až 1 000 Kč ročně při vkladu 20 000 Kč, ověřte aktuální výši) a peníze jsou vázané 6 let. Hodí se jako jistá složka; výnos bývá nižší než u investic." },
  { k: "penzijn|doplnkov|duchodov ; sporen|pripojist", a: "Doplňkové penzijní spoření má státní příspěvek a daňový odpočet; výhodné je zvlášť, když přispívá zaměstnavatel. Zvolte dynamičtější strategii, pokud máte do důchodu hodně let. Aktuální podmínky ověřte u penzijní společnosti." },
  { k: "dip|dlouhodoby investicni produkt", a: "DIP (dlouhodobý investiční produkt) umožňuje odečíst vklady od základu daně (společný limit s penzijním a životním pojištěním) a příspěvky zaměstnavatele jsou zvýhodněné. Peníze by měly zůstat investované do 60 let věku (min. 10 let)." },
  { k: "slozen|urok z uroku", a: "Složené úročení = úroky se přičítají k vkladu a dál se úročí. Proto se vyplatí začít spořit a investovat co nejdřív – čas dělá víc než výše vkladu." },
  { k: "inflac", a: "Inflace je růst cen – za stejné peníze si postupně koupíte méně. Peníze na běžném účtu bez úroku tak ztrácejí hodnotu; část úspor se proto vyplatí mít na spořicím účtu nebo dlouhodobě investovanou." },
  // ---------------- Investice ----------------
  { k: "invest|investic ; jak zacit|zacatecnik|kam|do ceho", a: "Pro začátek: mějte nejdřív rezervu a žádné drahé dluhy. Pak pravidelně investujte do široce diverzifikovaných indexových fondů (ETF) s nízkými poplatky a na dlouho (5+ let). Nejde o investiční doporučení – rozhodnutí je na vás." },
  { k: "etf|indexov ; fond", a: "ETF je fond obchodovaný na burze, který kopíruje index (např. tisíce firem z celého světa). Výhody: široká diverzifikace a nízké poplatky. Hodnota kolísá, proto se hodí na dlouhý horizont." },
  { k: "akcie", a: "Akcie = podíl ve firmě. Dlouhodobě mají nejvyšší výnos, ale i největší výkyvy. Jednotlivé akcie jsou rizikovější než fond s mnoha firmami." },
  { k: "dluhopis", a: "Dluhopis = půjčka státu nebo firmě za úrok. Je stabilnější než akcie, výnos bývá nižší. Státní dluhopisy patří k nejbezpečnějším." },
  { k: "diverzifik|rozlozit riziko", a: "Diverzifikace = nedávat všechna vejce do jednoho košíku: rozložit peníze mezi různé firmy, země a typy aktiv, aby propad jednoho nepoložil celé úspory." },
  { k: "kryptomen|bitcoin|krypto", a: "Kryptoměny jsou velmi rizikové – cena může během dní spadnout o desítky procent. Pokud vůbec, investujte jen malou část peněz, o kterou můžete přijít, a dejte si pozor na podvody s „garantovaným výnosem“." },
  { k: "poplatk ; fond|investic|banka", a: "Poplatky dělají za roky obrovský rozdíl: 2 % ročně proti 0,2 % může za 20 let znamenat o desítky procent menší výsledek. Sledujte vstupní poplatek a celkovou roční nákladovost (TER)." },
  { k: "zlato", a: "Zlato slouží spíš jako pojistka proti krizím než jako zdroj výnosu – nevyplácí úroky ani dividendy. Pokud ho chcete, ať je to menší část úspor." },
  { k: "nemovitost ; investic|pronajem|koupit byt", a: "Byt na pronájem může dávat stabilní příjem, ale počítejte s hypotékou, opravami, obdobími bez nájemníka a daněmi. Spočítejte si čistý výnos po všech nákladech a mějte rezervu." },
  // ---------------- Dluhy a úvěry ----------------
  { k: "rpsn", a: "RPSN je roční procentní sazba nákladů – ukazuje celkovou cenu úvěru včetně poplatků. Při srovnání půjček koukejte na RPSN, ne jen na úrok." },
  { k: "splat|splaceni|zbav ; dluh|pujck|uver", a: "Při více dluzích se osvědčí: splácet minimum všude a navíc posílat peníze na dluh s nejvyšším úrokem (lavina), nebo na nejmenší dluh (sněhová koule – víc motivuje). Nové dluhy zatím nedělejte." },
  { k: "konsolidac|slouceni ; pujck|uver|dluh", a: "Konsolidace = sloučení více úvěrů do jednoho s nižší splátkou. Vyplatí se, když je nové RPSN nižší a celkově zaplatíte méně – pozor na prodloužení splatnosti, které celkové náklady zvyšuje." },
  { k: "kontokorent|precerpani", a: "Kontokorent je drahý úvěr na účtu – úrok bývá vysoký. Hodí se jen na pár dní; dlouhodobě ho nahraďte rezervou nebo levnějším úvěrem." },
  { k: "kreditni kart", a: "Kreditní karta je výhodná jen když celou dlužnou částku zaplatíte v bezúročném období. Jinak naskakuje vysoký úrok – nespoléhejte na minimální splátku." },
  { k: "nebankovn|rychla pujck|pujcka bez", a: "Pozor na „rychlé půjčky bez registru“ – často mají extrémní RPSN a sankce. Při potížích se raději obraťte na bezplatnou dluhovou poradnu (např. Člověk v tísni, Poradna při finanční tísni)." },
  { k: "exekuc|insolvenc|oddluzen|osobni bankrot", a: "Při neřešitelných dluzích existuje oddlužení (osobní bankrot) přes insolvenční soud. Poradit a sepsat návrh pomohou bezplatně akreditované neziskové poradny. Nečekejte, s exekucemi dluh rychle roste." },
  { k: "nemuzu splacet|nestiham splacet|problem se splacenim", a: "Ozvěte se věřiteli dřív, než splátku zmeškáte – často jde dohodnout odklad nebo nižší splátky. Pomoc nabízí i bezplatné dluhové poradny. V aplikaci si nastavte dluh v Pravidelných platbách, ať vidíte, kolik zbývá." },
  { k: "hypotek ; fixac", a: "Fixace je doba, po kterou se nemění úrok hypotéky. Kratší fixace = rychleji se projeví pokles sazeb, delší = jistota splátky. Před koncem fixace porovnejte nabídky a vyjednávejte – refinancování bývá bez poplatku." },
  { k: "hypotek ; kolik|dostanu|vlastni zdroj|ltv|podminky", a: "Banky obvykle půjčí do 80 % hodnoty nemovitosti (mladým do 36 let i 90 %) a hlídají poměr splátky a dluhů k příjmu. Vlastní zdroje tedy aspoň 10–20 % ceny plus rezerva na poplatky. Přesné limity ověřte u banky." },
  { k: "refinanc", a: "Refinancování = převedení úvěru k jiné bance s lepšími podmínkami. U hypoték ke konci fixace bývá bez poplatku; porovnejte nabídky aspoň 3 měsíce předem." },
  { k: "leasing|na splatky ; auto|koup", a: "Nákup na splátky prodražuje věc o úroky. Spočítejte celkovou zaplacenou částku. Tady v chatu si můžete nechat spočítat dopad: „Co když koupíme auto za 300 000 na 48 splátek?“" },
  // ---------------- Pojištění a bezpečnost ----------------
  { k: "pojisteni ; odpovednost", a: "Pojištění odpovědnosti kryje škody, které způsobíte jiným (rozbitý telefon kamaráda, vytopení souseda). Je levné a velmi užitečné – často jde přidat k pojištění domácnosti." },
  { k: "pojisteni ; domacnost|nemovitost|byt", a: "Pojištění nemovitosti kryje stavbu, pojištění domácnosti vybavení. Hlídejte pojistnou částku podle skutečné hodnoty, jinak může pojišťovna plnění krátit (podpojištění)." },
  { k: "zivotni ; pojisten", a: "Životní pojištění dává smysl hlavně tehdy, když na vašem příjmu závisí rodina nebo hypotéka – kryje smrt a invaliditu. Investiční složku v pojistce většinou výhodněji nahradíte samostatným investováním." },
  { k: "cestovni ; pojisten", a: "Cestovní pojištění do zahraničí je nutnost – léčba může stát statisíce. Kartička EHIC kryje jen základní péči v EU a ne převoz domů. Seznam věcí na cestu ho v aplikaci připomene." },
  { k: "ehic|evropsky prukaz|karticka pojistovny", a: "EHIC (modrá kartička na zadní straně průkazu pojišťovny) zajistí nutnou péči v EU za stejných podmínek jako místním. Nenahrazuje cestovní pojištění." },
  { k: "podvod|phishing|falesn|sms ; banka|ucet|bankovnictvi", a: "Banka po vás nikdy nebude chtít heslo, PIN ani potvrzení plateb po telefonu nebo SMS s odkazem. Při podezření zavolejte na číslo banky z její stránky a případně zablokujte kartu." },
  { k: "bezpecn|ochrana ; data|udaje|homeos", a: "Vaše data vidíte jen vy a pozvaní členové; přístup je chráněný i na úrovni databáze. Správce aplikace vaše částky ani transakce nevidí. Data můžete kdykoli stáhnout nebo smazat.", href: "/soukromi" },
  // ---------------- Cestování a měny ----------------
  { k: "platit|plat|zaplat ; zahranic|dovolen|v cizine|cizin ; eur|korun|mistni men|cizi men|dcc|kurz", a: "V zahraničí plaťte vždy v místní měně. Když terminál nabídne platbu v korunách (DCC), odmítněte – kurz bývá o několik procent horší." },
  { k: "smenarn|vymena penez|vymen", a: "Směnárny na letištích a turistických místech mívají horší kurzy. Výhodnější bývá platit kartou v místní měně nebo vybrat z bankomatu banky (ne z bankomatů typu Euronet). Zkontrolujte poplatky své banky." },
  { k: "bankomat ; zahranic|eur|poplat", a: "V zahraničí vybírejte z bankomatů bank, odmítněte převod do korun (DCC) a zjistěte si poplatek své banky za výběr. Výběr v aplikaci zapište jako hotovost v cizí měně." },
  { k: "dalnicni znamk|myto|vinet", a: "Dálniční známky a mýto se liší podle zemí (Rakousko, Slovinsko, Chorvatsko, Maďarsko…) – kupujte je jen přes oficiální e-shopy. V cestě autem je připomene seznam věcí." },
  // ---------------- Dávky, rodina, sociální oblast ----------------
  { k: "pridavek ; dit", a: "Přídavek na dítě je dávka pro rodiny s nízkým příjmem. Nárok a částku spočítáte v kalkulačce MPSV a žádá se na Úřadu práce (lze online přes Jenda). Aktuální hranice ověřte – mění se." },
  { k: "rodicovsk ; prispevek", a: "Rodičovský příspěvek je celková částka, kterou si rodiče rozloží podle zvolené délky rodičovské (rychlejší čerpání = vyšší měsíční částka). Aktuální výši a podmínky ověřte na Úřadu práce / MPSV." },
  { k: "materske|penezita pomoc v materstvi|ppm", a: "Peněžitá pomoc v mateřství (mateřská) se vyplácí z nemocenského pojištění, obvykle 28 týdnů, a vychází z vašeho příjmu. Žádá se přes zaměstnavatele (OSVČ přes OSSZ, pokud platí nemocenské)." },
  { k: "otcovsk", a: "Otcovská (otcovská poporodní péče) je dávka pro otce na 2 týdny v prvních 6 týdnech po porodu. Podmínkou je účast na nemocenském pojištění; žádá se přes zaměstnavatele." },
  { k: "prispevek na bydleni|doplatek na bydleni", a: "Příspěvek na bydlení pomáhá, když náklady na bydlení převyšují určitý podíl příjmů domácnosti. Nárok spočítáte v kalkulačce MPSV, žádá se na Úřadu práce." },
  { k: "vyzivn ; neplati|nahradni|neprislo|kolik", a: "Výživné si zadejte jako pravidelný příjem – aplikace ohlídá, jestli přišlo. Když druhý rodič neplatí, lze žádat o náhradní výživné na Úřadu práce (po splnění podmínek). Výši stanoví dohoda nebo soud.", href: "/nastaveni#prijmy" },
  { k: "samozivitel|samozivitelk", a: "Samoživitelům pomůže: zadat výživné a dávky jako pravidelné příjmy, mít malou rezervu, ověřit nárok na přídavek na dítě a příspěvek na bydlení (kalkulačka MPSV) a při neplacení výživného žádat o náhradní výživné." },
  { k: "danove zvyhodneni|sleva na dit|na deti ; dan", a: "Daňové zvýhodnění na vyživované dítě snižuje daň (případně se vyplácí jako daňový bonus). Uplatňuje se přes zaměstnavatele v prohlášení k dani nebo v daňovém přiznání. Aktuální částky ověřte na stránkách Finanční správy." },
  { k: "sleva ; student|studenta", a: "Slevu na dani na studenta od roku 2024 zrušili. Student na brigádě si ale dál uplatňuje základní slevu na poplatníka podepsaným prohlášením u zaměstnavatele." },
  { k: "skolkovn", a: "Slevu na dani za umístění dítěte ve školce (školkovné) od roku 2024 zrušili." },
  { k: "sleva ; manzel|manzelk", a: "Sleva na manželku/manžela s nízkými příjmy se od roku 2024 uplatňuje jen v omezených případech (zejména péče o dítě do 3 let). Podmínky ověřte na Finanční správě." },
  { k: "nemocensk|neschopenk|pracovni neschopnost", a: "Prvních 14 dní nemoci platí zaměstnanci náhradu mzdy zaměstnavatel (první 3 dny také, od roku 2019), od 15. dne nemocenské ČSSZ. OSVČ má nemocenskou jen při dobrovolném placení nemocenského pojištění." },
  { k: "podpora v nezamestnanosti|prisel o praci|ztratil praci|nezamestnan", a: "Po ztrátě práce se hned zaregistrujte na Úřadu práce – podpora v nezaměstnanosti se počítá z předchozího příjmu a zdravotní pojištění pak platí stát. V aplikaci upravte rozpočty a zrušte zbytné platby." },
  { k: "duchod ; kolik|vypocet|predcasn|kdy", a: "Odhad důchodu a datum nároku zjistíte v ePortálu ČSSZ (informativní osobní list důchodového pojištění). Předčasný důchod je trvale krácený, proto se vyplatí spočítat si ho dopředu." },
  { k: "senior ; tipy|uspor|setr", a: "Pro seniory: zadejte důchod jako pravidelný příjem, hlídejte zálohy na energie, ověřte nárok na příspěvek na bydlení a využívejte slevy na jízdné. Jednoduchý režim Přehledu ukáže jen to podstatné." },
  { k: "student ; tipy|uspor|setr|brigad", a: "Studentům pomůže: sledovat brigády v sekci Práce, vařit levně podle receptů s cenou porce, studentské slevy na jízdné a tarify a už malá pravidelná částka na spoření." },
  { k: "kapesn ; dite|deti|kolik", a: "Kapesné učí děti hospodařit – důležitější než výše je pravidelnost a to, že o něm rozhodují samy. Mladším pomáhá třeba prasátko „utratit / ušetřit / darovat“." },
  // ---------------- Podnikání a daně ----------------
  { k: "pausaln ; dan", a: "Paušální daň = jedna měsíční platba za daň, sociální a zdravotní pojištění bez daňového přiznání a přehledů. Má tři pásma podle příjmů a druhu činnosti. Podmínky a částky na daný rok ověřte na Finanční správě." },
  { k: "vydajov ; pausal", a: "Výdajový paušál = místo skutečných výdajů odečtete procento z příjmů (podle druhu živnosti, např. 60 % u řemeslných živností). Procenta a stropy ověřte na daný rok." },
  { k: "zaloh ; socialn|zdravotn|pojisten", a: "OSVČ platí měsíční zálohy na sociální (OSSZ) a zdravotní pojištění (pojišťovna) – minimum se mění každý rok. Zadejte je do Pravidelných plateb, ať je aplikace odečítá z volných peněz.", href: "/platby" },
  { k: "prehled ; ossz|pojistovn|osvc", a: "Přehledy pro OSSZ a zdravotní pojišťovnu se podávají do měsíce po termínu daňového přiznání; podle nich se doplatí pojištění a nastaví nové zálohy." },
  { k: "danove priznani|priznani k dani ; kdy|termin|do kdy", a: "Daňové přiznání se podává zpravidla do začátku dubna (papírově) nebo začátkem května (elektronicky), s daňovým poradcem do 1. července. Přesné datum na daný rok ověřte na Finanční správě." },
  { k: "dph ; registrac|platce|limit|obrat", a: "Plátcem DPH se stáváte po překročení zákonného obratu (limit ověřte na daný rok) – od té doby fakturujete s DPH. Dobrovolná registrace se vyplatí hlavně, když máte zákazníky plátce DPH." },
  { k: "faktur ; nalezitost|co musi obsahovat|co tam", a: "Faktura neplátce DPH musí obsahovat: vaše jméno, adresu a IČO, údaje odběratele, číslo dokladu, datum vystavení, předmět plnění a částku. Plátce DPH navíc DIČ, DUZP, sazby a výši DPH." },
  { k: "odkladat ; dan|na dane|kolik", a: "OSVČ se vyplatí odkládat z každé přijaté platby část na daně a pojištění (podle režimu klidně 20–30 %). Založte si v aplikaci cíl „Daně“ a vkládejte hned po zaplacení faktury.", href: "/sporeni" },
  { k: "zivnost ; zaloz|zrid|jak", a: "Živnost ohlásíte na živnostenském úřadě (nebo online přes Portál občana) – stačí doklad totožnosti, volné živnosti bez zkoušek. Pak se do 8 dnů přihlaste na OSSZ a ke zdravotní pojišťovně." },
  { k: "vedlejs ; cinnost|podnikani|zivnost", a: "Vedlejší činnost OSVČ (vedle zaměstnání, studia, rodičovské…) má nižší povinné zálohy na sociální pojištění a pod určitou hranicí zisku se neplatí vůbec. Hranici ověřte na daný rok." },
  { k: "dpp|dpc|dohoda o provedeni|dohoda o pracovni ; limit|pojisteni|dan", a: "U DPP se pojištění platí jen nad měsíční limit (od 2025 navázaný na průměrnou mzdu – ověřte aktuální částku). Podepsané prohlášení k dani u jednoho zaměstnavatele dá slevu na poplatníka. Na DPP lze odpracovat max. 300 hodin ročně u jednoho zaměstnavatele." },
  { k: "hruba ; cista|mzda|rozdil", a: "Z hrubé mzdy se strhává sociální a zdravotní pojištění zaměstnance a daň (snížená o slevy). Čistou mzdu přesně spočítá mzdová kalkulačka; v aplikaci zapisujte příjem, který opravdu přijde na účet." },
  // ---------------- Jídlo a zdraví ----------------
  { k: "meal prep|vareni dopredu|do zasoby", a: "Meal prep = uvařit v neděli jídla na několik dní. Šetří čas i peníze. V Receptech vyberte 2–3 jídla, zvyšte počet porcí a suroviny pošlete do nákupního seznamu.", href: "/recepty" },
  { k: "kolik ; bilkovin|proteinu", a: "Při cvičení se obvykle doporučuje zhruba 1,6–2 g bílkovin na kilogram váhy denně. V Receptech filtrujte „Vysoký protein (30+ g)“.", href: "/recepty?cil=protein" },
  { k: "zhub|hubnuti|kaloricky deficit", a: "Na hubnutí je klíčový mírný kalorický deficit (zhruba 300–500 kcal denně) a dostatek bílkovin. V Receptech zvolte cíl „Na hubnutí“ – recepty do 500 kcal.", href: "/recepty?cil=hubnuti" },
  { k: "nabr|nabirani|svaly|objem", a: "Na nabírání potřebujete mírný kalorický přebytek a hodně bílkovin. V Receptech zvolte cíl „Na nabírání (650+ kcal)“.", href: "/recepty?cil=nabirani" },
  { k: "levne|levny|levna ; jidl|vareni|recept|obed", a: "Nejlevněji se vaří z luštěnin, vajec, sezónní zeleniny, rýže, brambor a vloček. V Receptech uvidíte orientační cenu porce u každého receptu.", href: "/recepty" },
  { k: "jidelnicek ; tyden|tydenni|plan", a: "Týdenní jídelníček: vyberte 3–4 jídla na obědy/večeře a 1–2 snídaně, vařte větší porce na dva dny a suroviny dejte do jednoho nákupního seznamu. Recepty najdete v sekci Recepty.", href: "/recepty" },
  { k: "makra|makronutrient", a: "Makra = bílkoviny, sacharidy a tuky. 1 g bílkovin i sacharidů má asi 4 kcal, 1 g tuku asi 9 kcal. U každého receptu je vidíte na porci.", href: "/recepty" },
  // ---------------- Bydlení ----------------
  { k: "najem ; kolik|podil|procent|drahy", a: "Na bydlení (nájem a energie) by nemělo jít víc než asi 30–35 % čistého příjmu domácnosti. Když jde víc, zvažte levnější bydlení nebo ověřte nárok na příspěvek na bydlení." },
  { k: "kauc|jistot ; najem|byt", a: "Kauce (jistota) u nájmu bývá nejvýše trojnásobek měsíčního nájmu a pronajímatel ji po skončení nájmu vrací i s úroky, po započtení případných dluhů." },
  { k: "vyuctovani ; energi|nedoplat|preplat|zaloh", a: "Po vyúčtování energií upravte zálohy v Pravidelných platbách. Nedoplatek si zapište jako výdaj, přeplatek jako příjem. Výše záloh se vyplatí hlídat podle skutečné spotřeby.", href: "/platby" },
  // ---------------- Další častá témata ----------------
  { k: "kde|jak ; vidim|zjistim|najdu|podivam ; kolik|utratil|utratili|vydaj|prijm", a: "Všechny pohyby najdete v Příjmy a výdaje (filtry podle měsíce, kategorie, účtu i textu). Rychle se mě můžete zeptat třeba „Kolik jsme minulý měsíc utratili za jídlo?“.", href: "/transakce" },
  { k: "povinne ruceni|havarijn|pojisteni auta|pojisteni vozidla", a: "Povinné ručení kryje škody, které autem způsobíte jiným (je povinné), havarijní pojištění kryje škody na vašem autě. Jednou ročně porovnejte nabídky – rozdíly bývají stovky až tisíce korun." },
  { k: "kolik stoji ; auto|vuz|automobil ; rok|rocne|mesic|km", a: "Auto stojí víc než palivo: pojištění, servis, pneumatiky, dálniční známka, STK, parkování a hlavně ztráta hodnoty. Zadejte tyto položky do Pravidelných plateb a kategorie Auto – uvidíte skutečné náklady." },
  { k: "registr dluzniku|solus|uverov registr|bankovni registr|nebankovni registr", a: "Výpis z úvěrových registrů (bankovní, nebankovní, SOLUS) si můžete vyžádat zdarma. Hodí se před žádostí o hypotéku nebo když nevíte, jaké dluhy evidují." },
  { k: "insolvencni rejstrik|centralni evidence exekuci|mam exekuci|zjistit exekuc", a: "Zda máte exekuci, zjistíte v Centrální evidenci exekucí (Exekutorská komora), insolvence v Insolvenčním rejstříku (zdarma online)." },
  { k: "stravenk|stravenkovy pausal|stravne", a: "Stravenkový paušál je peněžitý příspěvek na jídlo, který zaměstnavatel posílá místo stravenek; do limitu je pro vás osvobozený od daně. Zapisujte ho jako příjem." },
  { k: "vyplatni pask|srazk ; mzd|vyplat|vyplaty", a: "Na výplatní pásce najdete hrubou mzdu, sražené pojištění a daň, slevy a čistou mzdu. Do aplikace zapisujte částku, která skutečně přišla na účet." },
  { k: "13. plat|trinacty plat|odmen|bonus ; zamestnan|prace|vyplat|co s", a: "Mimořádný příjem (13. plat, bonus) se vyplatí rozdělit: část na rezervu nebo dluh, část na cíl a část si užít. V aplikaci ho zapište jako příjem a vklad na cíl." },
  { k: "svatb ; rozpocet|kolik stoji|naklady|planova", a: "Na svatbu si založte cíl ve Spoření a rozpočet rozepište do položek (místo, jídlo, šaty, foto). Nákupy můžete plánovat v Nákupech a hlídat, kolik ještě zbývá.", href: "/sporeni" },
  { k: "dit|miminko ; naklady|kolik stoji|pripravit|vybaveni", a: "Na příchod dítěte si udělejte seznam vybavení v Plánování → Nábytek a vybavení, založte cíl ve Spoření a ověřte dávky (mateřská, rodičovská, přídavek na dítě). Část věcí jde sehnat z druhé ruky." , href: "/planovani?tab=domov" },
  { k: "pes|kocka|zvire|mazlicek ; naklady|kolik stoji", a: "Mazlíček stojí krmivo, veterinu, očkování a pojištění. Založte kategorii „Zvíře“ a zadejte pravidelné výdaje – po pár měsících uvidíte skutečné roční náklady." },
  { k: "spolubydl|spolubydlici ; rozuctov|rozdelit|kdo kolik|platby", a: "Pro spolubydlení pozvěte ostatní do domácnosti a u výdajů zapisujte, kdo platil. Na společné výdaje typu dovolená použijte vyrovnání v Cestování." },
  { k: "poslat|prevest|posilat ; penize ; zahranic|do ciziny|eur", a: "Na posílání peněz do zahraničí porovnejte poplatky banky a specializované služby; v rámci EU je převod v eurech (SEPA) obvykle levný. Hlídejte kurz – rozdíl bývá v přepočtu." },
  { k: "okamzit ; platb|prevod", a: "Okamžité platby dorazí do několika sekund i o víkendu, pokud je podporují obě banky. V aplikaci se zapisují stejně jako běžný převod." },
  { k: "qr platb|qr kod ; zaplatit|plateb|jak", a: "QR platbu naskenujete v aplikaci své banky. HomeOS umí QR kód vytvořit při vyrovnání na cestách – stačí u účastníka doplnit číslo účtu.", href: "/cestovani" },
  { k: "kartou|hotove|hotovost ; platit|lepsi|vyplati", a: "Kartou máte lepší přehled (pohyby z výpisu jdou importovat), hotovost pomáhá hlídat limit. Ať platíte jakkoli, zapisujte výdaje do aplikace – rozpočet pak sedí." },
  { k: "vanoc|darky|darek ; rozpocet|usetr|kolik|planova", a: "Na Vánoce si založte cíl ve Spoření už v létě a dárky si zapisujte do Nákupů s cenou – uvidíte, jestli se vejdete. Vyhněte se nákupům na splátky.", href: "/sporeni" },
  { k: "black friday|vyprodej|slevov ; akce|nakupovat|vyplati", a: "U slev si předem napište, co opravdu potřebujete, a porovnejte cenu s historií (srovnávače cen). Sleva na věc, kterou byste jinak nekoupili, není úspora." },
  { k: "cashback|vernostni program|body za nakup", a: "Cashback a věrnostní programy se vyplatí jen u nákupů, které byste udělali tak jako tak. Získané peníze si zapište jako příjem." },
  { k: "osvc|podnikatel ; bez prijmu|nema prijem|ztrata|minimalni", a: "I bez příjmů platí OSVČ minimální zálohu na zdravotní pojištění (u hlavní činnosti) a obvykle i sociální – zjistěte, zda nemůžete činnost přerušit nebo převést na vedlejší." },
  { k: "zdravotni pojisten ; bez prace|osoba bez zdanitelnych|obzp|nezamestnan|student", a: "Kdo nemá žádný příjem ani není evidovaný na úřadu práce, platí si zdravotní pojištění sám (OBZP). Studenty do 26 let, důchodce, rodiče na rodičovské a uchazeče o práci platí stát." },
  { k: "home office|prace z domova ; naklady|nahrad|energi", a: "Při práci z domova můžete se zaměstnavatelem sjednat náhradu nákladů (energie, internet). Zapisujte ji jako příjem, náklady jako výdaje domácnosti." },
  { k: "kolik ; utratit|rozpocet ; dovolen|cest", a: "Rozpočet na dovolenou si naplánujte v Cestování – zadáte celkovou částku a aplikace spočítá, kolik můžete utratit na místě za den, a zahrne ji do plánovače.", href: "/cestovani" },
  { k: "elektronick|digitaln ; uctenk|doklad|archiv|dokument", a: "Účtenky, smlouvy a záruky ukládejte v sekci Dokumenty – jde v nich hledat i podle rozpoznaného textu.", href: "/dokumenty" },
  { k: "zaruk|reklamac", a: "Záruka u nového zboží od obchodníka je 24 měsíců. Doklad o koupi uložte do Dokumentů, ať ho při reklamaci rychle najdete.", href: "/dokumenty" },
  { k: "kolik|jak ; vydelavam|vydelal|vydelek ; hodin|smen|prace", a: "V sekci Práce vidíte výdělek za den, týden i měsíc a průměr na hodinu po odečtení nákladů. Zeptejte se mě: „Kolik jsem tento měsíc vydělal?“.", href: "/prace" },
  // ---------------- Obecné ----------------
  { k: "co umis|co umi|jak mi muzes pomoct|pomoc|napoveda|co se te muzu zeptat", a: "Umím odpovídat z vašich skutečných dat (kolik můžete utratit, kolik jste utratili za…, co vás čeká, výhled, co kdyby…) a poradit s rozpočtem, spořením, dluhy, investicemi, dávkami, podnikáním i vařením. Zkuste třeba „Kde můžeme ušetřit?“ nebo „Co je RPSN?“." },
  { k: "ahoj|dobry den|cau|zdravim|nazdar", a: "Dobrý den! Zeptejte se na cokoli o vašich financích – třeba „Kolik můžu tento týden utratit?“ nebo „Jak jsme na tom tento měsíc?“." },
  { k: "dekuji|diky|dik", a: "Rádo se stalo! Kdyby cokoli, jsem tady." },
];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Najde nejlépe odpovídající téma: musí sedět všechny skupiny; při shodě vyhrává téma s více skupinami. */
export function searchKb(question: string): KbEntry | null {
  const q = ` ${fold(question).replace(/[^a-z0-9/ ]/g, " ").replace(/\s+/g, " ")} `;
  let best: { e: KbEntry; groups: number; len: number } | null = null;
  for (const e of KB) {
    const groups = e.k.split(";").map((g) => g.split("|").map((w) => fold(w.trim())).filter(Boolean));
    let ok = true;
    let len = 0;
    for (const g of groups) {
      const hit = g.find((w) => q.includes(` ${w}`) || (w.includes(" ") && q.includes(w)));
      if (!hit) { ok = false; break; }
      len += hit.length;
    }
    if (ok && (!best || groups.length > best.groups || (groups.length === best.groups && len > best.len))) best = { e, groups: groups.length, len };
  }
  return best?.e ?? null;
}

/** Hrubý počet formulací, které báze pokrývá (kombinace variant ve skupinách). */
export function kbPhrasings(): number {
  return KB.reduce((a, e) => a + e.k.split(";").reduce((m, g) => m * g.split("|").length, 1), 0);
}
