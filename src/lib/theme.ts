/** Vzhled aplikace – ukládá se do cookie na zařízení. */
export const ACCENTS = {
  champagne: { label: "Champagne", gold: "#d4b483", bright: "#ecd3a2", deep: "#a9834d" },
  rose: { label: "Růžové zlato", gold: "#e0a899", bright: "#f3cdc2", deep: "#b9786a" },
  copper: { label: "Měď", gold: "#d08b5b", bright: "#ebb48c", deep: "#9c5a32" },
  coral: { label: "Korál", gold: "#f08a7e", bright: "#f8b8b0", deep: "#bf5a50" },
  citrine: { label: "Citrín", gold: "#e3c75f", bright: "#f2e09a", deep: "#ad9235" },
  emerald: { label: "Smaragd", gold: "#6fcf97", bright: "#a8e6c1", deep: "#3f9f6b" },
  turquoise: { label: "Tyrkys", gold: "#5fc9c0", bright: "#9be3dc", deep: "#2f958d" },
  sapphire: { label: "Safír", gold: "#7fa7e8", bright: "#b5cdf5", deep: "#4a73b8" },
  amethyst: { label: "Ametyst", gold: "#b59ae8", bright: "#d7c6f7", deep: "#8467c2" },
  platinum: { label: "Platina", gold: "#c9cdd3", bright: "#eef0f3", deep: "#8f959e" },
} as const;

export const BACKGROUNDS = {
  anthracite: { label: "Antracit", base: "#0a0a0b", base2: "#121214", top: "#0d0c0b" },
  midnight: { label: "Půlnoc", base: "#070a12", base2: "#0f1420", top: "#0a0f1c" },
  graphite: { label: "Grafit", base: "#16171a", base2: "#1e2024", top: "#1b1c20" },
  forest: { label: "Lesní noc", base: "#08110d", base2: "#0f1a15", top: "#0b1611" },
  bordeaux: { label: "Bordó", base: "#120a0c", base2: "#1b1013", top: "#170c10" },
  mocha: { label: "Mokka", base: "#14100c", base2: "#1d1712", top: "#19130e" },
  black: { label: "Čistá černá (OLED)", base: "#000000", base2: "#0b0b0c", top: "#000000" },
} as const;

/** Ilustrované interiéry na pozadí (rozmazané). Označené jako DEMO. */
export const SCENES = {
  none: { label: "Bez obrázku", file: null },
  obyvak: { label: "Obývák v teplém světle", file: "/backgrounds/obyvak.svg" },
  kuchyne: { label: "Skandinávská kuchyně", file: "/backgrounds/kuchyne.svg" },
  loznice: { label: "Ložnice za soumraku", file: "/backgrounds/loznice.svg" },
  loft: { label: "Loft s velkým oknem", file: "/backgrounds/loft.svg" },
  pracovna: { label: "Pracovna s knihovnou", file: "/backgrounds/pracovna.svg" },
} as const;

export type Accent = keyof typeof ACCENTS;
export type Background = keyof typeof BACKGROUNDS;
export type Scene = keyof typeof SCENES;

export interface Theme {
  accent: Accent;
  bg: Background;
  /** Interiér na pozadí, nebo vlastní fotka ("photo"). */
  scene: Scene | "photo";
  /** Id dokumentu s vlastní fotkou pozadí. */
  photo: string | null;
  glass: "soft" | "medium" | "strong";
  radius: "round" | "sharp";
  font: "normal" | "large";
  privacy: boolean;
  motion: boolean;
}

export const THEME_COOKIE = "homeos_theme";
export const DEFAULT_THEME: Theme = { accent: "champagne", bg: "anthracite", scene: "none", photo: null, glass: "medium", radius: "round", font: "normal", privacy: false, motion: true };

const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);

export function parseTheme(raw: string | undefined | null): Theme {
  if (!raw) return DEFAULT_THEME;
  let o: Record<string, unknown> = {};
  try {
    o = JSON.parse(decodeURIComponent(raw));
  } catch {
    const [a, b] = raw.split(":"); // starší formát „akcent:pozadí“
    o = { accent: a, bg: b };
  }
  return {
    accent: pick(o.accent, Object.keys(ACCENTS) as Accent[], DEFAULT_THEME.accent),
    bg: pick(o.bg, Object.keys(BACKGROUNDS) as Background[], DEFAULT_THEME.bg),
    scene: pick(o.scene, [...(Object.keys(SCENES) as Scene[]), "photo"] as const, "none"),
    photo: typeof o.photo === "string" && /^[0-9a-f-]{36}$/i.test(o.photo) ? o.photo : null,
    glass: pick(o.glass, ["soft", "medium", "strong"] as const, "medium"),
    radius: pick(o.radius, ["round", "sharp"] as const, "round"),
    font: pick(o.font, ["normal", "large"] as const, "normal"),
    privacy: o.privacy === true,
    motion: o.motion !== false,
  };
}

export function serializeTheme(t: Theme): string {
  return encodeURIComponent(JSON.stringify(t));
}

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const GLASS = { soft: ["0.035", "0.012", "16px"], medium: ["0.065", "0.025", "24px"], strong: ["0.11", "0.05", "34px"] } as const;

/** CSS proměnné pro zvolený vzhled – vkládají se na <html> už ze serveru (bez probliknutí). */
export function themeVars(t: Pick<Theme, "accent" | "bg"> & Partial<Theme>): Record<string, string> {
  const a = ACCENTS[t.accent];
  const b = BACKGROUNDS[t.bg];
  const g = GLASS[t.glass ?? "medium"];
  return {
    "--color-gold": a.gold,
    "--color-gold-bright": a.bright,
    "--color-gold-deep": a.deep,
    "--accent-rgb": rgb(a.gold),
    "--accent-deep-rgb": rgb(a.deep),
    "--color-base": b.base,
    "--color-base-2": b.base2,
    "--bg-top": b.top,
    "--glass-top": g[0],
    "--glass-bottom": g[1],
    "--glass-blur": g[2],
    "--radius-card": t.radius === "sharp" ? "0.75rem" : "1.5rem",
  };
}

export function sceneUrl(t: Theme): string | null {
  if (t.scene === "photo") return t.photo ? `/api/files/${t.photo}` : null;
  return SCENES[t.scene].file;
}

export function rootFontSize(t: Pick<Theme, "font">): string {
  return t.font === "large" ? "17.5px" : "16px";
}
