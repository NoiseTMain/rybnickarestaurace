import type { LifeProfile } from "@/lib/db/types";

/** Sekce, které si uživatel může skrýt (Přehled, Příjmy a výdaje a Nastavení zůstávají vždy). */
export const SECTIONS: { key: string; href: string; label: string }[] = [
  { key: "domacnost", href: "/domacnost", label: "Domácnost" },
  { key: "prace", href: "/prace", label: "Práce" },
  { key: "faktury", href: "/faktury", label: "Faktury" },
  { key: "nakupy", href: "/nakupy", label: "Nákupy" },
  { key: "planovani", href: "/planovani", label: "Plánování" },
  { key: "recepty", href: "/recepty", label: "Recepty" },
  { key: "cestovani", href: "/cestovani", label: "Cestování" },
  { key: "sporeni", href: "/sporeni", label: "Spoření" },
  { key: "majetek", href: "/majetek", label: "Majetek a dluhy" },
  { key: "rozpocty", href: "/rozpocty", label: "Rozpočty" },
  { key: "platby", href: "/platby", label: "Pravidelné platby" },
  { key: "asistent", href: "/asistent", label: "Finanční asistent" },
  { key: "dokumenty", href: "/dokumenty", label: "Dokumenty" },
];
export const SECTION_KEYS = SECTIONS.map((s) => s.key);
export const sectionOfHref = (href: string) => SECTIONS.find((s) => s.href === href)?.key ?? null;

export interface ProfileDef {
  key: LifeProfile;
  label: string;
  emoji: string;
  detail: string;
  /** Sekce, které se při výběru této situace skryjí (lze změnit v Nastavení). */
  hide: string[];
  /** Tipy a funkce navíc pro tuto situaci (v Premium balíčku). */
  tips: string[];
}

export const PROFILES: ProfileDef[] = [
  { key: "family", label: "Rodina s dětmi", emoji: "👨‍👩‍👧", detail: "Společné finance, jídlo pro celou rodinu, kroužky a školní výdaje.", hide: ["faktury"],
    tips: ["Založte si kategorie Děti, Kroužky a Škola – uvidíte, kolik stojí.", "Pravidelné platby (kroužky, obědy) si zadejte do Pravidelných plateb – nic nezapomenete.", "Rodinný rozpočet na jídlo rozpočítaný na týden šetří nejvíc.", "Na větší výdaje (tábor, dovolená) si založte cíl ve Spoření s termínem."] },
  { key: "couple", label: "Pár", emoji: "💑", detail: "Společné a osobní výdaje, kdo co platil, společné cíle.", hide: ["faktury"],
    tips: ["U výdajů rozlišujte Společný a Osobní – v Domácnosti uvidíte, kdo kolik dává.", "Pozvěte partnera do domácnosti v Nastavení – uvidíte stejná čísla.", "Společný cíl (bydlení, svatba) motivuje víc než dva samostatné."] },
  { key: "single", label: "Žiju sám/sama", emoji: "🧍", detail: "Jednoduchý přehled, kolik můžu utratit a kolik ušetřit.", hide: ["faktury", "domacnost"],
    tips: ["Nastavte si bezpečnostní rezervu aspoň na 3 měsíce výdajů.", "Pravidlo 50/30/20: nutné výdaje / chci / spoření."] },
  { key: "single_parent", label: "Samoživitel/ka", emoji: "🤱", detail: "Výživné, přídavky a dávky jako příjmy, rozpočet na děti, rezerva.", hide: ["faktury"],
    tips: ["Výživné a dávky si zadejte jako pravidelné příjmy – aplikace ohlídá, jestli přišly.", "Ověřte si nárok na přídavek na dítě, příspěvek na bydlení a další dávky (MPSV – kalkulačka dávek).", "Když výživné nechodí, lze žádat o náhradní výživné (Úřad práce).", "Malá rezerva i 500 Kč měsíčně pomůže při nečekaných výdajích."] },
  { key: "student", label: "Student/ka", emoji: "🎓", detail: "Brigády, stipendia, kapesné, levné jídlo a spoření.", hide: ["faktury", "domacnost"],
    tips: ["Brigády si evidujte v sekci Práce – uvidíte hodinovou mzdu.", "Při brigádě na DPP si hlídejte, ať u jednoho zaměstnavatele nepřekročíte limit, od kterého se platí pojištění (aktuální částku ověřte).", "Recepty s cenou porce pomohou vařit levně a zdravě."] },
  { key: "senior", label: "Senior/ka", emoji: "🧓", detail: "Důchod, léky, energie a jednoduchý přehled.", hide: ["faktury", "prace", "cestovani"],
    tips: ["Důchod si zadejte jako pravidelný příjem.", "Hlídejte zálohy na energie v Pravidelných platbách.", "Přehled stačí v jednoduchém režimu."] },
  { key: "entrepreneur", label: "Podnikatel / OSVČ", emoji: "💼", detail: "Faktury, IČO, zálohy na pojištění a daně, oddělení firmy a domácnosti.", hide: [],
    tips: ["Aktivujte IČO v Nastavení – faktury se ověří v ARES.", "Odkládejte si na daně a pojištění pravidelně (např. 20–30 % z příjmů) – založte cíl Daně.", "Zálohy na sociální a zdravotní pojištění si zadejte do Pravidelných plateb.", "Neplacené faktury po splatnosti uvidíte v Přehledu i v uzávěrce."] },
  { key: "freelancer", label: "Na volné noze", emoji: "🧑‍💻", detail: "Nepravidelné příjmy, faktury, rezerva na slabší měsíce.", hide: [],
    tips: ["Při nepravidelných příjmech počítejte s průměrem posledních 3 měsíců.", "Rezerva na 3–6 měsíců vás podrží v hubených měsících.", "Odkládejte na daně z každé faktury hned po zaplacení."] },
  { key: "courier", label: "Kurýr / řidič", emoji: "🚚", detail: "Směny, trasy, objednávky, náklady na auto a výplaty.", hide: [],
    tips: ["Zapisujte směny v sekci Práce – uvidíte skutečný výdělek na hodinu po odečtení nákladů.", "Pronájem auta, palivo a soukromé km si zadejte u směny.", "Očekávané výplaty se do volných peněz nepočítají, dokud nepřijdou."] },
];
export const PROFILE_KEYS = PROFILES.map((p) => p.key);
export const profileDef = (k: LifeProfile | null | undefined) => PROFILES.find((p) => p.key === k) ?? null;
