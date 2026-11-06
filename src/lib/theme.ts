/** Vzhled aplikace: barva zvýraznění a odstín pozadí (uloženo v cookie na zařízení). */
export const ACCENTS = {
  champagne: { label: "Champagne", gold: "#d4b483", bright: "#ecd3a2", deep: "#a9834d" },
  rose: { label: "Růžové zlato", gold: "#e0a899", bright: "#f3cdc2", deep: "#b9786a" },
  emerald: { label: "Smaragd", gold: "#6fcf97", bright: "#a8e6c1", deep: "#3f9f6b" },
  sapphire: { label: "Safír", gold: "#7fa7e8", bright: "#b5cdf5", deep: "#4a73b8" },
  amethyst: { label: "Ametyst", gold: "#b59ae8", bright: "#d7c6f7", deep: "#8467c2" },
  platinum: { label: "Platina", gold: "#c9cdd3", bright: "#eef0f3", deep: "#8f959e" },
} as const;

export const BACKGROUNDS = {
  anthracite: { label: "Antracit", base: "#0a0a0b", base2: "#121214", top: "#0d0c0b" },
  midnight: { label: "Půlnoc", base: "#070a12", base2: "#0f1420", top: "#0a0f1c" },
  graphite: { label: "Grafit", base: "#16171a", base2: "#1e2024", top: "#1b1c20" },
  black: { label: "Čistá černá (OLED)", base: "#000000", base2: "#0b0b0c", top: "#000000" },
} as const;

export type Accent = keyof typeof ACCENTS;
export type Background = keyof typeof BACKGROUNDS;

export const THEME_COOKIE = "homeos_theme";
export const DEFAULT_THEME = { accent: "champagne" as Accent, bg: "anthracite" as Background };

export function parseTheme(raw: string | undefined | null): { accent: Accent; bg: Background } {
  const [a, b] = String(raw ?? "").split(":");
  return {
    accent: a in ACCENTS ? (a as Accent) : DEFAULT_THEME.accent,
    bg: b in BACKGROUNDS ? (b as Background) : DEFAULT_THEME.bg,
  };
}

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** CSS proměnné pro zvolený vzhled – vkládají se na <html> už ze serveru (bez probliknutí). */
export function themeVars(accent: Accent, bg: Background): Record<string, string> {
  const a = ACCENTS[accent];
  const b = BACKGROUNDS[bg];
  return {
    "--color-gold": a.gold,
    "--color-gold-bright": a.bright,
    "--color-gold-deep": a.deep,
    "--accent-rgb": rgb(a.gold),
    "--accent-deep-rgb": rgb(a.deep),
    "--color-base": b.base,
    "--color-base-2": b.base2,
    "--bg-top": b.top,
  };
}
