import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Volitelná AI vrstva (Claude). Zapne se nastavením ANTHROPIC_API_KEY na serveru.
 * Zásada: AI nikdy nepočítá peníze – jen (a) rozumí volně položené otázce a převede ji
 * na strukturovaný dotaz, který spočítá aplikace z databáze, a (b) odhadne běžnou
 * cenu potraviny, pokud ji uživatel ještě nikdy nekoupil. Odhad je vždy označený.
 */
const MODEL = "claude-opus-5-5";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 });
  return client;
}

async function structured<T>(schema: z.ZodType<T>, jsonSchema: Record<string, unknown>, system: string, user: string, maxTokens = 2000): Promise<T | null> {
  if (!aiEnabled()) return null;
  try {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: jsonSchema } },
      system,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
    if (!text) return null;
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.warn("AI: rate limit");
    else if (e instanceof Anthropic.APIError) console.warn(`AI: chyba API ${e.status}`);
    else console.warn("AI: nedostupné", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Odhad ceny potraviny (v haléřích), s mezipamětí na 24 h

const priceCache = new Map<string, { at: number; value: { low: number; high: number; typical: number; note: string } | null }>();

const priceSchema = z.object({ known: z.boolean(), low_czk: z.number().nonnegative(), high_czk: z.number().nonnegative(), typical_czk: z.number().nonnegative(), note: z.string().max(200) });

export async function estimateGroceryPrice(name: string, quantity: string | null) {
  const key = `${name.toLowerCase().trim()}|${(quantity ?? "").toLowerCase().trim()}`;
  const hit = priceCache.get(key);
  if (hit && Date.now() - hit.at < 86_400_000) return hit.value;
  const r = await structured(
    priceSchema,
    {
      type: "object",
      additionalProperties: false,
      required: ["known", "low_czk", "high_czk", "typical_czk", "note"],
      properties: {
        known: { type: "boolean", description: "false, pokud jde o neznámou nebo nejednoznačnou položku" },
        low_czk: { type: "number" },
        high_czk: { type: "number" },
        typical_czk: { type: "number" },
        note: { type: "string", description: "krátce, česky: k jakému množství se cena vztahuje" },
      },
    },
    "Jsi pomocník pro plánování nákupu potravin v Česku. Odhadni běžné aktuální rozpětí ceny v českých supermarketech (Lidl, Albert, Kaufland, Billa, Penny, Tesco) pro zadané množství. Pokud množství chybí, vezmi obvyklé balení a napiš jaké. Když položku neznáš nebo je nejednoznačná, nastav known na false. Ceny v Kč jako čísla.",
    `Položka: ${name}\nMnožství: ${quantity ?? "neuvedeno"}`,
    1500,
  );
  const value = r && r.known && r.typical_czk > 0
    ? { low: Math.round(r.low_czk * 100), high: Math.round(r.high_czk * 100), typical: Math.round(r.typical_czk * 100), note: r.note }
    : null;
  priceCache.set(key, { at: Date.now(), value });
  return value;
}

// ---------------------------------------------------------------------------
// Porozumění otázce pro finančního asistenta

export const INTENTS = [
  "afford", "category_spend", "merchant_spend", "what_if", "forecast", "anomalies", "savings_tips", "work", "week", "food",
  "end_of_month", "invoices", "goals", "payments", "balance", "compare", "add_expense", "weekly_summary", "unknown",
] as const;

const intentSchema = z.object({
  intent: z.enum(INTENTS),
  amount_czk: z.number().nullable(),
  category: z.string().nullable(),
  merchant: z.string().nullable(),
  months: z.number().int().min(1).max(12).nullable(),
  installments: z.number().int().min(1).max(120).nullable(),
  scenario: z.enum(["purchase", "installments", "rent_change", "food_change", "income_change", "none"]).nullable(),
});

export type AiIntent = z.infer<typeof intentSchema>;

export async function interpretQuestion(question: string, categories: string[]): Promise<AiIntent | null> {
  return structured(
    intentSchema,
    {
      type: "object",
      additionalProperties: false,
      required: ["intent", "amount_czk", "category", "merchant", "months", "installments", "scenario"],
      properties: {
        intent: { type: "string", enum: [...INTENTS] },
        amount_czk: { type: ["number", "null"], description: "částka v Kč, kladná; u změny nájmu/jídla/příjmu rozdíl (může být záporný)" },
        category: { type: ["string", "null"], description: "přesný název z dodaného seznamu kategorií, nebo null" },
        merchant: { type: ["string", "null"], description: "obchod/obchodník (např. Lidl)" },
        months: { type: ["integer", "null"], description: "počet měsíců zpět/dopředu" },
        installments: { type: ["integer", "null"] },
        scenario: { type: ["string", "null"], enum: ["purchase", "installments", "rent_change", "food_change", "income_change", "none", null] },
      },
    },
    "Převádíš česky položené dotazy o rodinných financích na strukturovaný záměr. Nic nepočítej a nevymýšlej čísla – jen vyplň pole podle otázky. Pokud otázka obsahuje zadání výdaje (např. „250 Albert“), použij intent add_expense.",
    `Kategorie: ${categories.join(", ")}\nOtázka: ${question}`,
    1500,
  );
}
