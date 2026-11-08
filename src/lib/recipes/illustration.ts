/**
 * Ilustrace jídla (SVG) poskládaná ze skutečných surovin receptu a jejich gramáží:
 * co je v receptu víc, zabírá na talíři víc místa; koření, olej a podobné se nekreslí.
 * Nejde o fotku – je to věrný „náhled“, jak bude talíř vypadat.
 */
import type { Course } from "./bases";

type Shape =
  | "chunks" | "strips" | "fillet" | "grains" | "noodles" | "leaves" | "florets" | "rounds" | "egg" | "beans" | "cubes"
  | "slices" | "dollop" | "sprinkle" | "drizzle" | "wedges" | "berries" | "shrimp" | "nuts" | "rings" | "flat" | "shreds"
  | "sauce" | "sticks" | "mushroom" | "hidden";

interface Look { s: Shape; c: string; c2?: string }

export const LOOK: Record<string, Look> = {
  chicken: { s: "chunks", c: "#e7c08a", c2: "#b9803f" }, turkey: { s: "chunks", c: "#ecd3a9", c2: "#c49a5c" },
  beef: { s: "strips", c: "#7d3d2a", c2: "#4e2418" }, pork: { s: "rounds", c: "#d9a37b", c2: "#9c6440" },
  salmon: { s: "fillet", c: "#f08a5d", c2: "#fbd2bd" }, tuna: { s: "chunks", c: "#c7a28a", c2: "#9b7a64" },
  cod: { s: "fillet", c: "#f1dcb2", c2: "#fbf3e2" }, shrimp: { s: "shrimp", c: "#f4825d", c2: "#fbe0d2" },
  eggs: { s: "egg", c: "#fdfbf5", c2: "#f4b32a" }, egg_whites: { s: "flat", c: "#f7eccb", c2: "#e9cf7f" },
  tofu: { s: "cubes", c: "#f1e5c4", c2: "#d4c08f" }, chickpeas: { s: "beans", c: "#dcb46f", c2: "#b88b45" },
  beans: { s: "beans", c: "#8d3b2f", c2: "#5d2219" }, black_beans: { s: "beans", c: "#2e2426", c2: "#4b3d40" },
  red_lentils: { s: "grains", c: "#e2813a", c2: "#c4652a" }, cottage: { s: "dollop", c: "#f8f4ea", c2: "#e4dccb" },
  greek_yogurt: { s: "dollop", c: "#fbf9f3", c2: "#e6e0d2" }, skyr: { s: "dollop", c: "#fbfaf6", c2: "#e4e0d6" },
  tvaroh: { s: "dollop", c: "#faf6ec", c2: "#e2d9c4" }, protein: { s: "hidden", c: "#e9dcc6" },
  halloumi: { s: "slices", c: "#efe0b4", c2: "#b88a4a" }, mozzarella: { s: "rounds", c: "#fcfbf6", c2: "#e8e4d6" },
  edamame: { s: "beans", c: "#83bd4c", c2: "#5e9632" }, feta: { s: "cubes", c: "#fbf8ef", c2: "#e2dccb" },
  parmesan: { s: "sprinkle", c: "#f2e5b5" }, cheese: { s: "shreds", c: "#f2c94c" },
  rice: { s: "grains", c: "#fbf9f3", c2: "#e8e2d4" }, basmati: { s: "grains", c: "#fbf7ec", c2: "#e9dfc8" },
  quinoa: { s: "grains", c: "#e8d6a3", c2: "#c9b276" }, bulgur: { s: "grains", c: "#dfbd78", c2: "#b9944d" },
  couscous: { s: "grains", c: "#ecd18a", c2: "#c9a95c" }, pasta_ww: { s: "noodles", c: "#c99a5b", c2: "#a4783e" },
  potatoes: { s: "chunks", c: "#efcd7a", c2: "#c99a45" }, sweet_potato: { s: "cubes", c: "#ef8a3c", c2: "#c96a24" },
  oats: { s: "grains", c: "#e5d3b0", c2: "#c4ad84" }, bread: { s: "slices", c: "#e6c08a", c2: "#9c6230" },
  tortilla: { s: "flat", c: "#edd5a2", c2: "#c9a463" }, rice_noodles: { s: "noodles", c: "#f6f1e3", c2: "#ddd3bb" },
  buckwheat: { s: "grains", c: "#8d5c3c", c2: "#6a4128" }, broccoli: { s: "florets", c: "#3e8e3a", c2: "#8bbf5a" },
  spinach: { s: "leaves", c: "#2f6d34", c2: "#4f9450" }, tomato: { s: "rounds", c: "#e2412f", c2: "#f7a08e" },
  cucumber: { s: "rounds", c: "#cfe6a0", c2: "#3d7a2a" }, bell_pepper: { s: "strips", c: "#e5392b", c2: "#b5241a" },
  onion: { s: "rings", c: "#efe2ec" }, red_onion: { s: "rings", c: "#9c4f8b" }, garlic: { s: "hidden", c: "#f3eedd" },
  carrot: { s: "rounds", c: "#f08a24", c2: "#d26c12" }, zucchini: { s: "rounds", c: "#d7e9a7", c2: "#3b6e2a" },
  eggplant: { s: "rounds", c: "#e8dcbf", c2: "#4b2a5a" }, mushrooms: { s: "mushroom", c: "#d2bc9e", c2: "#8d7356" },
  lettuce: { s: "leaves", c: "#8cc152", c2: "#b6dc82" }, cabbage: { s: "shreds", c: "#cfe2a0" },
  cauliflower: { s: "florets", c: "#f3eedb", c2: "#d8cfb3" }, green_beans: { s: "sticks", c: "#4f9a3a", c2: "#3a7a2a" },
  peas: { s: "berries", c: "#6fbe3f", c2: "#a6dd7c" }, corn: { s: "berries", c: "#f6c945", c2: "#fbe48f" },
  avocado: { s: "wedges", c: "#b8d36a", c2: "#4f6f1d" }, olives: { s: "rings", c: "#3a302b" },
  lemon: { s: "wedges", c: "#f8de4b", c2: "#fdf3b0" }, lime: { s: "wedges", c: "#8bc34a", c2: "#cfe8a6" },
  passata: { s: "sauce", c: "#c8392a" }, canned_tomatoes: { s: "sauce", c: "#c9402d" },
  bok_choy: { s: "leaves", c: "#7cb342", c2: "#eef5dd" }, spring_onion: { s: "sprinkle", c: "#6fbe3f" },
  ginger: { s: "hidden", c: "#e6c98f" }, chili: { s: "sprinkle", c: "#d6281e" }, herbs: { s: "sprinkle", c: "#3e8e41" },
  sauerkraut: { s: "shreds", c: "#e7dfa6" }, banana: { s: "rounds", c: "#f8e9a8", c2: "#e5cf73" },
  berries: { s: "berries", c: "#7b2d8b", c2: "#d63a4a" }, apple: { s: "wedges", c: "#f7e9b5", c2: "#c8322a" },
  olive_oil: { s: "hidden", c: "#e8c53a" }, coconut_milk: { s: "sauce", c: "#f4ecda" },
  peanut_butter: { s: "drizzle", c: "#b37b3d" }, tahini: { s: "drizzle", c: "#e6cf9f" }, soy_sauce: { s: "hidden", c: "#3b2314" },
  honey: { s: "drizzle", c: "#e9a92a" }, curry_paste: { s: "sauce", c: "#d9822b" }, spices: { s: "hidden", c: "#a0522d" },
  salsa: { s: "dollop", c: "#d8452f", c2: "#f08a6e" }, hummus: { s: "dollop", c: "#e3c58e", c2: "#c9a463" },
  milk: { s: "sauce", c: "#f8f5ee" }, almonds: { s: "nuts", c: "#c48a55", c2: "#9b6334" }, walnuts: { s: "nuts", c: "#9c6b3c", c2: "#6e4622" },
  chia: { s: "sprinkle", c: "#3a3a3a" }, sesame: { s: "sprinkle", c: "#f3e3b5" }, miso: { s: "hidden", c: "#c9953f" },
  sour_cream: { s: "dollop", c: "#fbfaf5", c2: "#e6e2d6" }, mustard: { s: "hidden", c: "#d8a520" },
  cocoa: { s: "hidden", c: "#5a3420" }, dark_chocolate: { s: "cubes", c: "#3c2417", c2: "#5e3a26" },
  flour: { s: "hidden", c: "#f5efe2" }, ham: { s: "slices", c: "#f0a0a0", c2: "#d97a7a" }, pesto: { s: "sauce", c: "#5f8f2f" },
  pumpkin: { s: "cubes", c: "#f08c2a", c2: "#c96a12" }, beetroot: { s: "cubes", c: "#8e1b3e", c2: "#b8325c" },
  cream_cheese: { s: "dollop", c: "#fbf8f0", c2: "#e6dfcf" },
};

const BG: Record<string, [string, string]> = {
  ceska: ["#5b3b25", "#3f2817"], italska: ["#6b4a2e", "#4a301b"], recka: ["#2f5d7c", "#1d3f57"], mexicka: ["#a0502a", "#6e3418"],
  thajska: ["#2f5a3a", "#1d3d26"], indicka: ["#8a3a1f", "#5e2512"], japonska: ["#3a3a3f", "#232328"], spanelska: ["#9a5a2a", "#6b3b18"],
  blizkovychodni: ["#7a5a3a", "#523b24"], americka: ["#44506a", "#2c364b"],
};

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const n1 = (x: number) => Math.round(x * 10) / 10;

function mix(colors: [string, number][]): string {
  let r = 0, g = 0, b = 0, w = 0;
  for (const [c, k] of colors) {
    const v = parseInt(c.slice(1), 16);
    r += ((v >> 16) & 255) * k; g += ((v >> 8) & 255) * k; b += (v & 255) * k; w += k;
  }
  if (!w) return "#d9c9a8";
  const h = (x: number) => Math.round(x / w).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Jeden kousek suroviny na pozici x,y (velikost s, natočení rot). */
function piece(l: Look, x: number, y: number, s: number, rot: number, rnd: () => number): string {
  const t = `transform="translate(${n1(x)} ${n1(y)}) rotate(${Math.round(rot)})"`;
  const c2 = l.c2 ?? l.c;
  switch (l.s) {
    case "chunks": return `<g ${t}><rect x="${n1(-s * 0.6)}" y="${n1(-s * 0.45)}" width="${n1(s * 1.2)}" height="${n1(s * 0.9)}" rx="${n1(s * 0.3)}" fill="${l.c}"/><path d="M${n1(-s * 0.4)} ${n1(-s * 0.1)}h${n1(s * 0.8)}" stroke="${c2}" stroke-width="${n1(s * 0.12)}" opacity=".6" stroke-linecap="round"/></g>`;
    case "strips": return `<g ${t}><rect x="${n1(-s * 1.1)}" y="${n1(-s * 0.26)}" width="${n1(s * 2.2)}" height="${n1(s * 0.52)}" rx="${n1(s * 0.26)}" fill="${l.c}"/><rect x="${n1(-s * 0.9)}" y="${n1(-s * 0.08)}" width="${n1(s * 1.4)}" height="${n1(s * 0.12)}" rx="${n1(s * 0.06)}" fill="${c2}" opacity=".5"/></g>`;
    case "fillet": return `<g ${t}><rect x="${n1(-s * 1.6)}" y="${n1(-s * 0.85)}" width="${n1(s * 3.2)}" height="${n1(s * 1.7)}" rx="${n1(s * 0.7)}" fill="${l.c}"/>${[-0.9, -0.3, 0.3, 0.9].map((k) => `<path d="M${n1(s * k)} ${n1(-s * 0.7)}q${n1(s * 0.25)} ${n1(s * 0.7)} 0 ${n1(s * 1.4)}" stroke="${c2}" stroke-width="${n1(s * 0.1)}" fill="none" opacity=".8"/>`).join("")}</g>`;
    case "grains": return `<ellipse ${t} rx="${n1(s * 0.32)}" ry="${n1(s * 0.16)}" fill="${rnd() < 0.5 ? l.c : c2}"/>`;
    case "noodles": return `<path ${t} d="M${n1(-s * 1.6)} 0c${n1(s * 0.5)} ${n1(-s * 0.7)} ${n1(s * 0.9)} ${n1(s * 0.7)} ${n1(s * 1.6)} 0s${n1(s * 1.1)} ${n1(s * 0.7)} ${n1(s * 1.6)} 0" stroke="${rnd() < 0.6 ? l.c : c2}" stroke-width="${n1(s * 0.22)}" fill="none" stroke-linecap="round"/>`;
    case "leaves": return `<g ${t}><path d="M0 ${n1(-s)}Q${n1(s * 0.75)} 0 0 ${n1(s)}Q${n1(-s * 0.75)} 0 0 ${n1(-s)}z" fill="${l.c}"/><path d="M0 ${n1(-s * 0.8)}V${n1(s * 0.8)}" stroke="${c2}" stroke-width="${n1(s * 0.08)}"/></g>`;
    case "florets": return `<g ${t}><rect x="${n1(-s * 0.12)}" y="0" width="${n1(s * 0.24)}" height="${n1(s * 0.7)}" fill="${c2}"/><circle cx="${n1(-s * 0.3)}" cy="${n1(-s * 0.05)}" r="${n1(s * 0.34)}" fill="${l.c}"/><circle cx="${n1(s * 0.3)}" cy="${n1(-s * 0.05)}" r="${n1(s * 0.34)}" fill="${l.c}"/><circle cx="0" cy="${n1(-s * 0.35)}" r="${n1(s * 0.38)}" fill="${l.c}"/></g>`;
    case "rounds": return `<g ${t}><circle r="${n1(s * 0.6)}" fill="${c2}"/><circle r="${n1(s * 0.5)}" fill="${l.c}"/><circle cx="${n1(-s * 0.15)}" cy="${n1(-s * 0.15)}" r="${n1(s * 0.14)}" fill="#fff" opacity=".25"/></g>`;
    case "egg": return `<g ${t}><ellipse rx="${n1(s * 0.75)}" ry="${n1(s * 0.6)}" fill="${l.c}"/><circle cx="${n1(s * 0.05)}" r="${n1(s * 0.32)}" fill="${c2}"/></g>`;
    case "beans": return `<ellipse ${t} rx="${n1(s * 0.36)}" ry="${n1(s * 0.26)}" fill="${rnd() < 0.7 ? l.c : c2}"/>`;
    case "cubes": return `<g ${t}><rect x="${n1(-s * 0.4)}" y="${n1(-s * 0.4)}" width="${n1(s * 0.8)}" height="${n1(s * 0.8)}" rx="${n1(s * 0.14)}" fill="${l.c}"/><rect x="${n1(-s * 0.4)}" y="${n1(s * 0.2)}" width="${n1(s * 0.8)}" height="${n1(s * 0.2)}" rx="${n1(s * 0.1)}" fill="${c2}" opacity=".6"/></g>`;
    case "slices": return `<g ${t}><rect x="${n1(-s * 1.1)}" y="${n1(-s * 0.75)}" width="${n1(s * 2.2)}" height="${n1(s * 1.5)}" rx="${n1(s * 0.35)}" fill="${c2}"/><rect x="${n1(-s * 0.95)}" y="${n1(-s * 0.6)}" width="${n1(s * 1.9)}" height="${n1(s * 1.2)}" rx="${n1(s * 0.28)}" fill="${l.c}"/></g>`;
    case "mushroom": return `<g ${t}><path d="M${n1(-s * 0.6)} 0a${n1(s * 0.6)} ${n1(s * 0.5)} 0 0 1 ${n1(s * 1.2)} 0z" fill="${l.c}"/><rect x="${n1(-s * 0.16)}" y="0" width="${n1(s * 0.32)}" height="${n1(s * 0.45)}" rx="${n1(s * 0.1)}" fill="${l.c}"/><path d="M${n1(-s * 0.55)} 0h${n1(s * 1.1)}" stroke="${c2}" stroke-width="${n1(s * 0.08)}"/></g>`;
    case "dollop": return `<g ${t}><path d="M0 ${n1(-s)}c${n1(s * 0.6)} 0 ${n1(s * 1.05)} ${n1(s * 0.4)} ${n1(s)} ${n1(s * 0.95)}s${n1(-s * 0.5)} ${n1(s * 1.05)} ${n1(-s)} ${n1(s * 1.05)}s${n1(-s * 1.1)} ${n1(-s * 0.45)} ${n1(-s * 1.05)} ${n1(-s * 1.05)}S${n1(-s * 0.55)} ${n1(-s)} 0 ${n1(-s)}z" fill="${l.c}"/><path d="M${n1(-s * 0.4)} ${n1(-s * 0.2)}q${n1(s * 0.4)} ${n1(-s * 0.35)} ${n1(s * 0.8)} 0" stroke="${c2}" stroke-width="${n1(s * 0.12)}" fill="none" stroke-linecap="round"/></g>`;
    case "sprinkle": return rnd() < 0.5 ? `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(s * 0.16)}" fill="${l.c}"/>` : `<rect ${t} x="${n1(-s * 0.2)}" y="${n1(-s * 0.08)}" width="${n1(s * 0.4)}" height="${n1(s * 0.16)}" rx="${n1(s * 0.08)}" fill="${l.c}"/>`;
    case "wedges": return `<g ${t}><path d="M0 0L${n1(s * 1.1)} ${n1(-s * 0.35)}A${n1(s * 1.15)} ${n1(s * 1.15)} 0 0 1 ${n1(s * 1.1)} ${n1(s * 0.35)}z" fill="${c2}"/><path d="M${n1(s * 0.12)} 0L${n1(s * 1)} ${n1(-s * 0.27)}A${n1(s)} ${n1(s)} 0 0 1 ${n1(s * 1)} ${n1(s * 0.27)}z" fill="${l.c}"/></g>`;
    case "berries": return `<g ${t}><circle r="${n1(s * 0.3)}" fill="${rnd() < 0.6 ? l.c : c2}"/><circle cx="${n1(-s * 0.09)}" cy="${n1(-s * 0.09)}" r="${n1(s * 0.08)}" fill="#fff" opacity=".35"/></g>`;
    case "shrimp": return `<g ${t}><path d="M${n1(-s * 0.6)} 0a${n1(s * 0.6)} ${n1(s * 0.6)} 0 1 1 ${n1(s * 0.6)} ${n1(s * 0.6)}" stroke="${l.c}" stroke-width="${n1(s * 0.42)}" fill="none" stroke-linecap="round"/><path d="M${n1(-s * 0.2)} ${n1(-s * 0.55)}l${n1(s * 0.1)} ${n1(s * 0.3)}M${n1(s * 0.3)} ${n1(-s * 0.35)}l${n1(-s * 0.2)} ${n1(s * 0.25)}" stroke="${c2}" stroke-width="${n1(s * 0.08)}"/></g>`;
    case "nuts": return `<g ${t}><ellipse rx="${n1(s * 0.42)}" ry="${n1(s * 0.26)}" fill="${l.c}"/><path d="M${n1(-s * 0.3)} 0h${n1(s * 0.6)}" stroke="${c2}" stroke-width="${n1(s * 0.06)}"/></g>`;
    case "rings": return `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(s * 0.42)}" stroke="${l.c}" stroke-width="${n1(s * 0.16)}" fill="none"/>`;
    case "shreds": return `<path ${t} d="M${n1(-s * 0.6)} 0q${n1(s * 0.6)} ${n1(-s * 0.2)} ${n1(s * 1.2)} 0" stroke="${l.c}" stroke-width="${n1(s * 0.14)}" fill="none" stroke-linecap="round"/>`;
    case "sticks": return `<rect ${t} x="${n1(-s * 1)}" y="${n1(-s * 0.11)}" width="${n1(s * 2)}" height="${n1(s * 0.22)}" rx="${n1(s * 0.11)}" fill="${rnd() < 0.6 ? l.c : c2}"/>`;
    default: return "";
  }
}

/** Velikost kousku podle tvaru (px při šířce 400). */
const SIZE: Partial<Record<Shape, number>> = {
  chunks: 21, strips: 17, rounds: 21, cubes: 21, beans: 13, berries: 15, leaves: 22, florets: 24, wedges: 25, egg: 26, slices: 25,
  mushroom: 22, nuts: 15, rings: 17, shreds: 17, sticks: 19, shrimp: 21, grains: 13, noodles: 13, fillet: 26, sprinkle: 9,
};

/** Rozmístí kousky rovnoměrně (bez velkého překrývání) do oblasti dané funkcí point(). */
function place(out: string[], l: Look, count: number, size: number, point: () => [number, number], rnd: () => number, minDist = size * 0.75) {
  const pts: [number, number][] = [];
  for (let k = 0, tries = 0; k < count && tries < count * 12; tries++) {
    const [x, y] = point();
    if (pts.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 < minDist * minDist) && tries < count * 10) continue;
    pts.push([x, y]); k++;
    out.push(piece(l, x, y, size * (0.88 + rnd() * 0.24), rnd() * 360, rnd));
  }
}

export interface IllustrationInput { id: string; course: Course; cuisine: string; ingredients: { key: string; grams: number }[] }

const W = 400, H = 300, CX = 200, CY = 150;
const PLATE: Record<string, [string, string]> = {
  ceska: ["#f4efe4", "#c9b48f"], italska: ["#fbf9f4", "#d8d2c4"], recka: ["#f7f8fa", "#2f6d9a"], mexicka: ["#f3e6d2", "#b5562c"],
  thajska: ["#f2f0e8", "#5b8a5a"], indicka: ["#f6efe2", "#b0702a"], japonska: ["#ecebe6", "#3b3b40"], spanelska: ["#f6eedd", "#c4762c"],
  blizkovychodni: ["#f6f0e2", "#2a7a8a"], americka: ["#fbfbf8", "#9aa3b5"],
};

/** SVG ilustrace talíře/misky pro variantu receptu. */
export function dishSvg(r: IllustrationInput): string {
  const rnd = rng(r.id);
  const items = r.ingredients
    .map((i) => ({ ...i, l: LOOK[i.key] ?? { s: "chunks", c: "#c9a77a" } as Look }))
    .filter((i) => i.l.s !== "hidden")
    .sort((a, b) => b.grams - a.grams);
  const [bg1, bg2] = BG[r.cuisine] ?? BG.ceska;
  const [plate, rim] = PLATE[r.cuisine] ?? PLATE.italska;
  const bowl = r.course === "polevka" || r.course === "bowl" || r.course === "salat" || (r.course === "snidane" && items[0] && ["dollop", "grains", "sauce"].includes(items[0].l.s));
  const R = 132;
  const inner = bowl ? R - 14 : R - 26;
  const zone = inner * (bowl ? 0.96 : 0.86);
  const parts: string[] = [];
  parts.push(`<defs><radialGradient id="t" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></radialGradient><radialGradient id="p" cx="42%" cy="38%" r="65%"><stop offset="0" stop-color="#ffffff"/><stop offset=".8" stop-color="${plate}"/><stop offset="1" stop-color="${rim}"/></radialGradient><radialGradient id="sh" cx="50%" cy="50%" r="50%"><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient><clipPath id="c"><circle cx="${CX}" cy="${CY}" r="${inner}"/></clipPath></defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#t)"/>`);
  for (let k = 0; k < 7; k++) parts.push(`<path d="M0 ${n1(20 + k * 45 + rnd() * 10)}c120 ${n1(rnd() * 16 - 8)} 280 ${n1(rnd() * 16 - 8)} 400 0" stroke="#000" stroke-opacity=".08" stroke-width="2" fill="none"/>`);
  parts.push(`<ellipse cx="${CX + 8}" cy="${CY + 12}" rx="${R + 2}" ry="${R - 2}" fill="#000" opacity=".35"/>`);
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#p)"/>`);
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R - 3}" fill="none" stroke="${rim}" stroke-width="3" opacity=".55"/>`);
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${inner}" fill="${bowl ? "#e6dfd0" : plate}"/>`);
  if (!bowl) parts.push(`<circle cx="${CX}" cy="${CY}" r="${inner}" fill="none" stroke="#000" stroke-opacity=".06" stroke-width="3"/>`);
  const food: string[] = [];
  const inDisc = (rad: number) => (): [number, number] => { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * rad; return [CX + Math.cos(a) * d, CY + Math.sin(a) * d]; };

  const sauces = items.filter((i) => i.l.s === "sauce");
  const flats = items.filter((i) => i.l.s === "flat");
  const sprinkles = items.filter((i) => i.l.s === "sprinkle");
  const drizzles = items.filter((i) => i.l.s === "drizzle");
  let solids = items.filter((i) => !["sauce", "flat", "sprinkle", "drizzle"].includes(i.l.s));

  if (r.course === "polevka") {
    // vývar/krém: barva podle toho, co je v polévce rozvařené
    const liquid = mix([...items.map((i) => [i.l.c, i.grams] as [string, number]), ["#f0dcb4", 220]]);
    food.push(`<circle cx="${CX}" cy="${CY}" r="${inner}" fill="${liquid}"/><circle cx="${CX}" cy="${CY}" r="${inner}" fill="url(#sh)"/><ellipse cx="${CX - 30}" cy="${CY - 35}" rx="${inner * 0.5}" ry="${inner * 0.3}" fill="#fff" opacity=".08"/>`);
    for (const it of solids.slice(0, 4)) {
      const size = (SIZE[it.l.s] ?? 20) * 0.9;
      place(food, it.l, Math.max(3, Math.min(10, Math.round(it.grams / 18))), size, inDisc(inner * 0.75), rnd);
    }
  } else {
    if (sauces.length) food.push(`<path d="${blob(CX, CY, zone, rnd)}" fill="${mix(sauces.map((i) => [i.l.c, i.grams]))}"/><circle cx="${CX}" cy="${CY}" r="${zone}" fill="url(#sh)"/>`);
    for (const f of flats) food.push(`<path d="${blob(CX, CY, zone * 0.98, rnd)}" fill="${f.l.c2}"/><path d="${blob(CX, CY, zone * 0.9, rnd)}" fill="${f.l.c}"/>`);
    const noodles = solids.filter((i) => i.l.s === "noodles");
    if (noodles.length && r.course === "testoviny") {
      for (const it of noodles) { food.push(`<path d="${blob(CX, CY, zone * 0.8, rnd)}" fill="${it.l.c2}" opacity=".55"/>`); place(food, it.l, 120, SIZE.noodles!, inDisc(zone * 0.74), rnd, 4); }
      solids = solids.filter((i) => i.l.s !== "noodles");
      const area = Math.PI * (zone * 0.6) ** 2;
      const tot = solids.slice(0, 5).reduce((s, i) => s + i.grams, 0) || 1;
      for (const it of solids.slice(0, 5)) {
        const size = SIZE[it.l.s] ?? 20;
        place(food, it.l, Math.max(2, Math.min(14, Math.round((area * 0.45 * it.grams / tot) / (size * size)))), size, inDisc(zone * 0.6), rnd);
      }
    } else {
      // výseče jako na „bowlu“ – velikost podle gramů
      const vis = solids.slice(0, 6);
      const weights = vis.map((i) => Math.sqrt(i.grams));
      const total = weights.reduce((s, w) => s + w, 0) || 1;
      let a0 = rnd() * Math.PI * 2;
      vis.forEach((it, idx) => {
        const span = (weights[idx] / total) * Math.PI * 2;
        const area = (span / 2) * zone * zone;
        const s0 = a0, s1 = a0 + span;
        const inSector = (pad: number) => (): [number, number] => {
          const a = s0 + pad / zone + rnd() * Math.max(0.02, span - (2 * pad) / zone);
          const d = pad + Math.sqrt(rnd()) * (zone - 2 * pad);
          return [CX + Math.cos(a) * d, CY + Math.sin(a) * d];
        };
        const size = SIZE[it.l.s] ?? 20;
        if (it.l.s === "grains" || it.l.s === "leaves" || it.l.s === "shreds") {
          food.push(`<path d="${sector(CX, CY, zone, s0 + 0.02, s1 - 0.02)}" fill="${it.l.s === "leaves" ? it.l.c2 ?? it.l.c : it.l.c}" stroke="${it.l.c2 ?? it.l.c}" stroke-opacity=".5"/>`);
          place(food, it.l, Math.min(170, Math.round(area / (it.l.s === "grains" ? 45 : size * size * 0.55))), size, inSector(6), rnd, it.l.s === "grains" ? 3 : size * 0.5);
        } else if (it.l.s === "dollop") {
          const ac = s0 + span / 2, d = zone * 0.52;
          food.push(piece(it.l, CX + Math.cos(ac) * d, CY + Math.sin(ac) * d, Math.max(14, Math.min(34, Math.sqrt(area) * 0.34)), rnd() * 360, rnd));
        } else if (it.l.s === "fillet") {
          const ac = s0 + span / 2, d = zone * 0.5;
          food.push(piece(it.l, CX + Math.cos(ac) * d, CY + Math.sin(ac) * d, Math.max(20, Math.min(34, Math.sqrt(area) * 0.3)), (ac * 180) / Math.PI + 90, rnd));
        } else {
          place(food, it.l, Math.max(1, Math.min(60, Math.round((area * 0.8) / (size * size)))), size, inSector(size * 0.55), rnd);
        }
        a0 = s1;
      });
    }
  }
  for (const d of drizzles) {
    for (let k = 0; k < 3; k++) {
      const y = CY - zone * 0.35 + k * zone * 0.35;
      food.push(`<path d="M${n1(CX - zone * 0.7)} ${n1(y)}c${n1(zone * 0.3)} ${n1(-zone * 0.25)} ${n1(zone * 0.5)} ${n1(zone * 0.25)} ${n1(zone * 0.7)} 0s${n1(zone * 0.45)} ${n1(-zone * 0.2)} ${n1(zone * 0.7)} 0" stroke="${d.l.c}" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".9"/>`);
    }
  }
  for (const s of sprinkles) place(food, s.l, Math.max(8, Math.min(30, Math.round(s.grams * 2))), SIZE.sprinkle!, inDisc(zone * 0.8), rnd, 4);
  parts.push(`<g clip-path="url(#c)">${food.join("")}</g>`);
  if (bowl) parts.push(`<circle cx="${CX}" cy="${CY}" r="${inner}" fill="none" stroke="#000" stroke-opacity=".1" stroke-width="5"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${parts.join("")}</svg>`;
}

function sector(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
  return `M${cx} ${cy}L${n1(x0)} ${n1(y0)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${n1(x1)} ${n1(y1)}z`;
}

function blob(cx: number, cy: number, r: number, rnd: () => number): string {
  const n = 9, pts: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, rr = r * (0.9 + rnd() * 0.12);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  let d = `M${n1((pts[0][0] + pts[n - 1][0]) / 2)} ${n1((pts[0][1] + pts[n - 1][1]) / 2)}`;
  for (let k = 0; k < n; k++) {
    const p = pts[k], q = pts[(k + 1) % n];
    d += `Q${n1(p[0])} ${n1(p[1])} ${n1((p[0] + q[0]) / 2)} ${n1((p[1] + q[1]) / 2)}`;
  }
  return `${d}z`;
}
