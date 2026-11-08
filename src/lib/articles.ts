/** Veřejné články o osobních financích (SEO). Obecné rady, ne finanční poradenství. */
export interface Article { slug: string; title: string; description: string; emoji: string; minutes: number; sections: { h?: string; p: string[]; list?: string[] }[]; cta?: { href: string; label: string } }

export const ARTICLES: Article[] = [
  {
    slug: "rodinny-rozpocet", emoji: "🧮", minutes: 4,
    title: "Jak sestavit rodinný rozpočet, který vydrží",
    description: "Jednoduchý postup v pěti krocích a pravidlo 50/30/20 – bez tabulek, které po týdnu přestanete vyplňovat.",
    sections: [
      { p: ["Rozpočet není o tom zakázat si radost. Je to plán, díky kterému víte, kolik můžete utratit bez výčitek – a kolik vám zbude na to, na čem vám záleží."] },
      { h: "1. Spočítejte čisté příjmy", p: ["Sečtěte všechno, co domácnosti reálně přijde na účet za měsíc: výplaty, přídavky, výživné, příjmy z podnikání. Nepravidelné příjmy počítejte střízlivě – raději průměr za horší měsíce."] },
      { h: "2. Vypište pevné výdaje", p: ["Nájem nebo hypotéka, energie, internet, telefony, pojištění, splátky, školka, kroužky, předplatné. To jsou peníze, které „odejdou samy“ – a proto je musíte vidět jako první."] },
      { h: "3. Rozdělte zbytek podle 50/30/20", p: ["Osvědčené vodítko: zhruba 50 % příjmů na nutné výdaje, 30 % na to, co chcete (restaurace, zábava, koníčky), a 20 % na spoření a splácení dluhů. Neberte to dogmaticky – jde o startovní bod."] },
      { h: "4. Jídlo plánujte po týdnech", p: ["Jídlo je největší proměnlivý výdaj většiny domácností. Měsíční částku vydělte čtyřmi a hlídejte týdenní limit – je mnohem snazší ho dodržet než jedno velké měsíční číslo."] },
      { h: "5. Jednou měsíčně udělejte uzávěrku", p: ["Na konci měsíce se podívejte, kde jste přestřelili a kde ušetřili, a rozpočet upravte. Rozpočet, který se nikdy nemění, se po čase přestane používat."] },
    ],
    cta: { href: "/registrace", label: "Vyzkoušet rozpočet v HomeOS zdarma" },
  },
  {
    slug: "financni-rezerva", emoji: "🛟", minutes: 3,
    title: "Finanční rezerva: kolik a kam s ní",
    description: "Proč mít polštář na 3–6 měsíců výdajů, jak ho postupně naspořit a kde ho držet.",
    sections: [
      { p: ["Rozbitá pračka, nemoc, výpověď. Rezerva je to, co z nepříjemnosti nedělá krizi – a co vás chrání před drahými půjčkami."] },
      { h: "Kolik", p: ["Běžné doporučení jsou 3–6 měsíců nutných výdajů (ne příjmů). Samoživitelé, OSVČ a lidé s nejistým příjmem by měli mířit spíš k horní hranici."] },
      { h: "Jak ji naspořit", list: ["Začněte malým cílem – třeba jedna měsíční výplata.", "Nastavte trvalý příkaz hned po výplatě, ne „co zbude“.", "Mimořádné příjmy (13. plat, vratka daní) pošlete rovnou do rezervy."], p: [] },
      { h: "Kde ji držet", p: ["Na spořicím účtu nebo v termínovaném vkladu s rychlou dostupností – odděleně od běžného účtu, aby nesváděla. Rezerva nemá vydělávat, má být po ruce."] },
    ],
    cta: { href: "/kalkulacky#dovolit", label: "Spočítat, za jak dlouho rezervu naspořím" },
  },
  {
    slug: "jak-splatit-dluhy", emoji: "⛓️", minutes: 4,
    title: "Jak rychle splatit dluhy: lavina, nebo sněhová koule?",
    description: "Dvě osvědčené strategie splácení, jejich výhody a jak si spočítat, kdy budete bez dluhů.",
    sections: [
      { p: ["Máte víc půjček najednou? Platit všude jen minimum je nejdražší cesta. Pomůže pořadí a každá koruna navíc."] },
      { h: "Lavina – nejdřív nejdražší dluh", p: ["Všude platíte minimální splátky a všechno navíc posíláte na dluh s nejvyšším úrokem (typicky kreditní karta nebo kontokorent). Matematicky nejlevnější varianta."] },
      { h: "Sněhová koule – nejdřív nejmenší dluh", p: ["Navíc platíte nejmenší dluh, i když nemá nejvyšší úrok. Rychle ho splatíte, uvolněnou splátku přidáte na další – a motivace roste. Stojí o něco víc na úrocích, ale lidé ji častěji dotáhnou do konce."] },
      { h: "Co dál", list: ["Zvažte konsolidaci, pokud dostanete výrazně nižší RPSN.", "Neberte novou půjčku na splácení staré bez propočtu.", "Při problémech se splácením se obraťte včas na věřitele nebo bezplatnou dluhovou poradnu."], p: [] },
    ],
    cta: { href: "/registrace", label: "Spočítat svůj plán splacení v HomeOS" },
  },
  {
    slug: "usetrit-na-jidle", emoji: "🛒", minutes: 3,
    title: "Jak ušetřit na jídle a nejíst hůř",
    description: "Plánování jídelníčku, nákupní seznam, letáky a vaření dopředu – praktické tipy pro rodiny.",
    sections: [
      { list: ["Plánujte jídla na týden a nakupujte podle seznamu – omezíte impulzivní nákupy.", "Vařte ve větším a zamrazte porce – méně objednávek jídla.", "Sledujte akce v letácích u věcí, které stejně kupujete; neberte věci jen proto, že jsou ve slevě.", "Porovnávejte cenu za kilogram, ne za balení.", "Zbytky využijte druhý den – polévka, rizoto, tortilla.", "Nechoďte nakupovat hladoví."], p: [] },
      { p: ["Největší rozdíl obvykle neudělá levnější obchod, ale méně vyhozeného jídla a méně jídla z venku."] },
    ],
    cta: { href: "/registrace", label: "Hlídat rozpočet na jídlo po týdnech" },
  },
  {
    slug: "predplatna", emoji: "🔁", minutes: 3,
    title: "Předplatná, o kterých nevíte: jak je najít a zrušit",
    description: "Streamování, aplikace, cloud, posilovna. Malé částky, které ročně dělají tisíce.",
    sections: [
      { p: ["199 Kč měsíčně vypadá jako nic. Ročně je to 2 388 Kč – a takových plateb mívá domácnost klidně deset."] },
      { h: "Jak na to", list: ["Projděte výpis z účtu za poslední 3 měsíce a vypište vše, co se opakuje.", "U každé položky si řekněte: použil jsem to minulý měsíc?", "Zrušte, co nepoužíváte – vrátit se jde vždycky.", "Hlídejte zdražení: služby často zdražují potichu.", "Zkušební verze si zapisujte i s datem konce."], p: [] },
    ],
    cta: { href: "/registrace", label: "Nechat HomeOS najít předplatná za mě" },
  },
  {
    slug: "hypoteka", emoji: "🏠", minutes: 4,
    title: "Hypotéka: na co myslet, než podepíšete",
    description: "Vlastní zdroje, poměr splátky k příjmu, délka fixace a rezerva po koupi.",
    sections: [
      { h: "Vlastní zdroje", p: ["Banky běžně půjčí jen část hodnoty nemovitosti (LTV), zbytek musíte mít vlastní. Počítejte i s poplatky, odhadem, daní a vybavením."] },
      { h: "Splátka vs. příjem", p: ["Česká národní banka dává bankám doporučení, jak vysoké mají být splátky vůči příjmu. I když vám banka půjčí víc, nastavte si vlastní komfortní hranici – život přináší i nečekané výdaje."] },
      { h: "Fixace", p: ["Delší fixace = jistota splátky, kratší = šance na pokles sazeb, ale i riziko růstu. Konec fixace si zapište – je to ideální chvíle vyjednat lepší podmínky nebo refinancovat."] },
      { h: "Rezerva po koupi", p: ["Po koupi by vám měla zůstat rezerva aspoň na několik měsíců splátek a nutných výdajů."] },
    ],
    cta: { href: "/kalkulacky#hypoteka", label: "Spočítat splátku hypotéky" },
  },
  {
    slug: "dovolena-bez-dluhu", emoji: "✈️", minutes: 3,
    title: "Dovolená bez dluhů: jak si ji naplánovat a naspořit",
    description: "Rozpočet cesty, odkládání po měsících a hlídání útraty na místě.",
    sections: [
      { list: ["Sepište předem všechny položky: doprava, ubytování, jídlo, výlety, pojištění, rezerva.", "Částku vydělte počtem měsíců do odjezdu a odkládejte pravidelně.", "Zálohy a doplatky si zapište jako plánované platby.", "Na místě si stanovte denní limit a hlídejte ho.", "Platby v cizí měně kartou bez poplatků bývají výhodnější než směnárna."], p: [] },
    ],
    cta: { href: "/registrace", label: "Naplánovat cestu v HomeOS" },
  },
  {
    slug: "kapesne", emoji: "🧒", minutes: 3,
    title: "Kapesné pro děti: kolik, od kdy a proč",
    description: "Jak s kapesným naučit děti hospodařit – pravidla, která fungují.",
    sections: [
      { p: ["Kapesné není odměna za známky ani za pomoc doma. Je to nástroj, na kterém se dítě učí, že peníze jsou omezené a že na větší věc se šetří."] },
      { h: "Pravidla, která fungují", list: ["Pravidelnost – stejný den, stejná částka.", "Dítě o kapesném rozhoduje samo, i když udělá chybu.", "Mladším dětem dávejte týdně, starším měsíčně.", "Pomozte mu založit cíl na větší věc a sledovat, jak roste.", "Částku přizpůsobte věku a tomu, co z ní má dítě platit."], p: [] },
    ],
    cta: { href: "/registrace", label: "Spravovat kapesné a dětské cíle v HomeOS" },
  },
  {
    slug: "osvc-odkladani-na-dane", emoji: "🧾", minutes: 4,
    title: "OSVČ: kolik si odkládat na daně a pojištění",
    description: "Jak se počítá daň, sociální a zdravotní pojištění a proč si odkládat každý měsíc.",
    sections: [
      { p: ["Nejčastější chyba začínajících podnikatelů: utratí všechno, co přijde na účet, a v březnu je překvapí doplatek daně a pojistného."] },
      { h: "Z čeho se platí", list: ["Daň z příjmů: 15 % ze základu (zisk po výdajích), nad vysokou hranici 23 %; od daně se odečítá sleva na poplatníka.", "Sociální pojištění: z poloviny zisku a kousek (vyměřovací základ), alespoň minimální zálohy.", "Zdravotní pojištění: z poloviny zisku, alespoň minimální zálohy."], p: [] },
      { h: "Výdajový paušál", p: ["Místo skutečných výdajů můžete uplatnit procento z příjmů (podle druhu činnosti 80, 60, 40 nebo 30 %) s ročním stropem. Pro mnoho drobných živnostníků to bývá výhodnější a jednodušší."] },
      { h: "Praktické pravidlo", p: ["Z každé přijaté faktury si odložte pevné procento na samostatný účet. Přesnou částku si spočítejte podle svých čísel – parametry se každý rok mění, proto je ověřujte na webu Finanční správy a ČSSZ."] },
    ],
    cta: { href: "/registrace", label: "Daňový pomocník OSVČ v HomeOS" },
  },
];

export const articleBySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug);
