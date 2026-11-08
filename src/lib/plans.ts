/** Tarify a funkce Premium (sdílené mezi serverem a klientem). */

export const PRICES = { monthly: 4900, yearly: 44900 } as const;

export const PREMIUM_FEATURES = [
  { key: "ai", title: "AI finanční asistent", detail: "Ptejte se na cokoli – odpovídá z vašich skutečných dat. A čtení účtenek a faktur z fotky." },
  { key: "travel", title: "Cestování", detail: "Trasy, doprava, rozpočet na místě, hotovost v cizí měně, vyrovnání mezi účastníky, program, seznam věcí." },
  { key: "notify", title: "Upozornění a měsíční uzávěrka", detail: "Týdenní souhrn, připomínky plateb a cest na telefon, přehled měsíce." },
  { key: "family", title: "Více členů a domácností", detail: "Neomezeně členů a domácností (zdarma 2 členové a 1 domácnost)." },
  { key: "look", title: "Vzhled", detail: "Všechny barvy a interiérová pozadí." },
] as const;

export const FREE_LIMITS = { members: 2, households: 1 } as const;

/** Počet dotazů na AI za měsíc v rámci Premium (kvůli nákladům na AI). */
export const AI_MONTHLY_LIMIT = 300;

/** Barvy a pozadí zdarma (ostatní jsou Premium). */
export const FREE_ACCENTS: readonly string[] = ["champagne", "sapphire", "emerald"];
export const FREE_BACKGROUNDS: readonly string[] = ["anthracite", "black"];
export const FREE_SCENES: readonly string[] = ["none"];
