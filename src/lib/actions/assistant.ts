"use server";
import { requireContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { answer, type AssistantAnswer, type AssistantContext } from "@/lib/assistant";
import { aiEnabled, interpretQuestion } from "@/lib/ai";
import { getPremium } from "@/lib/premium";

/**
 * Odpověď asistenta. Nejdřív deterministické rozpoznání; když otázce nerozumí
 * a je zapnutá AI, nechá ji jen převést na strukturovaný dotaz – čísla vždy
 * počítá aplikace z databáze.
 */
export async function askAssistant(question: string, prev?: AssistantContext | null): Promise<AssistantAnswer> {
  const ctx = await requireContext();
  const { data, snapshot } = await loadSnapshot(ctx);
  const q = String(question).slice(0, 500);
  const first = answer(q, snapshot, data, prev ?? null);
  if (first.context?.intent !== "unknown" || !aiEnabled() || !(await getPremium(ctx)).household) return first;
  const intent = await interpretQuestion(q, data.categories.filter((c) => c.kind === "expense").map((c) => c.name));
  if (!intent || intent.intent === "unknown") return first;
  const forced: Partial<AssistantContext> = {
    intent: intent.intent,
    amount: intent.amount_czk != null ? Math.round(intent.amount_czk * 100) : null,
    category: intent.category,
    merchant: intent.merchant,
    months: intent.months,
    installments: intent.installments,
    scenario: intent.scenario && intent.scenario !== "none" ? intent.scenario : null,
  };
  // přímé dotazy, které umí základní engine, převedeme na jeho formulaci
  const rephrase: Record<string, string> = {
    afford: `Můžeme si dovolit koupit za ${(forced.amount ?? 0) / 100} Kč?`,
    week: "Kolik můžeme utratit tento týden?",
    food: "Kolik nám zbývá na jídlo?",
    end_of_month: "Kolik nám zbude na konci měsíce?",
    invoices: "Máme faktury po splatnosti?",
    goals: "Kolik musíme odkládat na cíle?",
    work: "Kolik jsem tento měsíc vydělal v práci?",
    payments: "Jaké platby nás čekají?",
    balance: "Jaký máme zůstatek?",
    compare: "Jak jsme na tom oproti minulému měsíci?",
  };
  const r = rephrase[intent.intent] && (intent.intent !== "afford" || forced.amount)
    ? answer(rephrase[intent.intent], snapshot, data, prev ?? null)
    : answer(q, snapshot, data, prev ?? null, forced);
  return { ...r, viaAi: true };
}

export async function assistantStatus(): Promise<{ ai: boolean }> {
  return { ai: aiEnabled() };
}
