import type { Category } from "@/lib/db/types";

type CatDef = Pick<Category, "name" | "kind" | "icon" | "color" | "is_food" | "is_household">;

/** Výchozí kategorie nové domácnosti – lze je upravit, archivovat i přidat vlastní. */
export const DEFAULT_CATEGORIES: CatDef[] = [
  { name: "Nájem", kind: "expense", icon: "home", color: "#d4b483", is_food: false, is_household: true },
  { name: "Elektřina", kind: "expense", icon: "zap", color: "#e8c872", is_food: false, is_household: true },
  { name: "Voda", kind: "expense", icon: "droplets", color: "#7fb3d5", is_food: false, is_household: true },
  { name: "Plyn", kind: "expense", icon: "flame", color: "#e59866", is_food: false, is_household: true },
  { name: "Internet", kind: "expense", icon: "wifi", color: "#85c1e9", is_food: false, is_household: true },
  { name: "Telefony", kind: "expense", icon: "smartphone", color: "#a9cce3", is_food: false, is_household: true },
  { name: "Potraviny", kind: "expense", icon: "shopping-basket", color: "#9ccc65", is_food: true, is_household: true },
  { name: "Drogerie", kind: "expense", icon: "spray-can", color: "#ce93d8", is_food: false, is_household: true },
  { name: "Domácí potřeby", kind: "expense", icon: "sofa", color: "#bcaaa4", is_food: false, is_household: true },
  { name: "Doprava", kind: "expense", icon: "bus", color: "#90a4ae", is_food: false, is_household: false },
  { name: "Auto", kind: "expense", icon: "car", color: "#78909c", is_food: false, is_household: false },
  { name: "Pojištění", kind: "expense", icon: "shield", color: "#80cbc4", is_food: false, is_household: true },
  { name: "Cestování", kind: "expense", icon: "plane", color: "#4fc3f7", is_food: false, is_household: false },
  { name: "Zábava", kind: "expense", icon: "party-popper", color: "#f48fb1", is_food: false, is_household: false },
  { name: "Restaurace", kind: "expense", icon: "utensils", color: "#ffab91", is_food: false, is_household: false },
  { name: "Ostatní", kind: "expense", icon: "circle", color: "#b0bec5", is_food: false, is_household: false },
  { name: "Mzda / výplata", kind: "income", icon: "wallet", color: "#d4b483", is_food: false, is_household: false },
  { name: "Práce / brigády", kind: "income", icon: "truck", color: "#c5e1a5", is_food: false, is_household: false },
  { name: "Ostatní příjmy", kind: "income", icon: "plus-circle", color: "#b0bec5", is_food: false, is_household: false },
];

export const MEMBER_COLORS = ["#d4b483", "#9ccc65", "#7fb3d5", "#f48fb1", "#ffab91", "#ce93d8"];

export const PAYMENT_METHOD_LABEL = {
  card: "Karta",
  cash: "Hotovost",
  transfer: "Převodem",
  direct_debit: "Inkaso",
  other: "Jinak",
} as const;

export const ACCOUNT_KIND_LABEL = { checking: "Běžný účet", cash: "Hotovost", savings: "Spořicí účet" } as const;

export const GOAL_KIND_LABEL = {
  reserve: "Rezerva",
  home: "Vybavení domácnosti",
  car: "Auto",
  vacation: "Dovolená",
  business: "Vlastní podnikání",
  other: "Vlastní cíl",
} as const;

export const PURCHASE_STATUS_LABEL = { planned: "Plánuji", buying: "Kupuji", bought: "Koupeno" } as const;

export const DOCUMENT_KIND_LABEL = {
  invoice: "Faktura",
  receipt: "Účtenka",
  contract: "Smlouva",
  statement: "Výpis",
  other: "Ostatní",
} as const;
