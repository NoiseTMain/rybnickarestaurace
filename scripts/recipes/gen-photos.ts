/**
 * Vygeneruje realistickou fotku ke každému jídlu (výchozí varianta) přes Replicate (FLUX)
 * podle skutečných surovin receptu a uloží ji do public/recipes/<id>.webp.
 *
 *   npx tsx scripts/recipes/gen-photos.ts            # jen chybějící fotky
 *   ONLY=gulas,kulajda npx tsx scripts/recipes/gen-photos.ts --force
 *
 * Token: REPLICATE_API_TOKEN (v cloudovém prostředí ho doplní síťová proxy).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { DISHES, type Dish } from "@/lib/recipes";
import en from "@/lib/i18n/phrases/en.json";

const MODEL = process.env.MODEL ?? "black-forest-labs/flux-dev";
const OUT = join(process.cwd(), "public/recipes");
const FORCE = process.argv.includes("--force");
const ONLY = process.env.ONLY?.split(",").filter(Boolean);
const LIMIT = Number(process.env.LIMIT) || Infinity;
const token = process.env.REPLICATE_API_TOKEN ?? "set-by-proxy";
const EN = (en as { exact: Record<string, string> }).exact;
const tr = (s: string) => EN[s] ?? s;

const SERVE: Record<Dish["course"], string> = {
  snidane: "breakfast served on a ceramic plate", polevka: "soup served in a deep ceramic bowl", salat: "salad served in a wide bowl",
  bowl: "bowl meal with ingredients arranged in sections in a wide bowl", testoviny: "pasta dish served on a plate",
  hlavni: "main course served on a ceramic plate", svacina: "snack served on a small plate or wooden board", dezert: "dessert served on a small plate",
};
const SKIP = new Set(["spices", "olive_oil", "garlic", "ginger", "soy_sauce", "flour", "protein", "mustard", "miso"]);

export function prompt(d: Dish): string {
  const r = d.def;
  const ing = r.ingredients.filter((i) => !SKIP.has(i.key)).sort((a, b) => b.grams - a.grams).map((i) => `${tr(i.name).replace(/\s*\(.*?\)/g, "")} (${i.grams} g)`);
  return [
    `Realistic professional food photograph of "${tr(d.title)}", a home-cooked ${SERVE[d.course]}, one portion.`,
    `The dish visibly contains exactly these ingredients in these proportions: ${ing.join(", ")}.`,
    `No other main ingredients. Natural daylight, 45-degree angle, shallow depth of field, rustic table, appetizing, photorealistic, sharp focus.`,
    `No text, no logos, no people, no hands, no cutlery clutter.`,
  ].join(" ");
}

async function generate(d: Dish): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=60" },
      body: JSON.stringify({ input: { prompt: prompt(d), aspect_ratio: "4:3", output_format: "webp", output_quality: 90, num_outputs: 1, disable_safety_checker: false } }),
    });
    let p = await res.json() as { id?: string; status?: string; output?: string[] | string; error?: string; detail?: string; urls?: { get: string } };
    if (res.status === 429 && attempt < 6) { await new Promise((r) => setTimeout(r, 10_000 * attempt)); continue; }
    if (!res.ok) throw new Error(`${d.id}: ${res.status} ${p.detail ?? p.error ?? ""}`);
    while (p.status && !["succeeded", "failed", "canceled"].includes(p.status)) {
      await new Promise((r) => setTimeout(r, 2000));
      p = await (await fetch(p.urls!.get, { headers: { Authorization: `Bearer ${token}` } })).json();
    }
    if (p.status !== "succeeded" || !p.output) {
      if (attempt < 3) continue;
      throw new Error(`${d.id}: ${p.status} ${p.error ?? ""}`);
    }
    const url = Array.isArray(p.output) ? p.output[0] : p.output;
    const img = await fetch(url);
    if (!img.ok) throw new Error(`${d.id}: stažení ${img.status}`);
    return Buffer.from(await img.arrayBuffer());
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const todo = DISHES.filter((d) => (!ONLY || ONLY.includes(d.id)) && (FORCE || !existsSync(join(OUT, `${d.id}.webp`)))).slice(0, LIMIT);
  console.log(`Generuji ${todo.length} fotek (${MODEL})…`);
  let ok = 0, failed = 0;
  const queue = [...todo];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      try {
        const raw = await generate(d);
        const webp = await sharp(raw).resize(960, 720, { fit: "cover" }).webp({ quality: 74 }).toBuffer();
        writeFileSync(join(OUT, `${d.id}.webp`), webp);
        ok++; console.log(`✓ ${d.id} (${Math.round(webp.length / 1024)} kB)`);
      } catch (e) { failed++; console.error(`✗ ${e instanceof Error ? e.message : e}`); }
    }
  }));
  const have = DISHES.filter((d) => existsSync(join(OUT, `${d.id}.webp`))).map((d) => d.id);
  writeFileSync(join(process.cwd(), "src/lib/recipes/photos.ts"), `/**\n * Jídla, která mají realistickou fotku v public/recipes/<id>.webp (vygenerovanou AI podle surovin).\n * Soubor přepisuje scripts/recipes/gen-photos.ts – ručně neupravovat.\n */\nexport const PHOTOS: ReadonlySet<string> = new Set<string>(${JSON.stringify(have)});\n`);
  console.log(`Hotovo: ${ok} nových, ${failed} chyb, celkem s fotkou ${have.length}/${DISHES.length}.`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("gen-photos.ts")) void main();
