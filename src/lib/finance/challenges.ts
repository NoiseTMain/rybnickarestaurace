import type { Category, Challenge, ChallengeKind, SavingsContribution, Transaction } from "@/lib/db/types";
import { addDays, addMonths, endOfMonth, type ISODate } from "@/lib/dates";
import { formatMoney, type Cents } from "@/lib/money";
import { recordingStreak } from "./badges";

const TAKEOUT = /restaur|venku|fast ?food|kavárn|kavarn|rozvoz|bistro|wolt|bolt food|foodora|dáme jídlo|oběd/i;
export const takeoutCategories = (cats: readonly Category[]) => cats.filter((c) => c.kind === "expense" && TAKEOUT.test(c.name));

export const CHALLENGE_META: Record<ChallengeKind, { emoji: string; title: string; unit: "money" | "days" | "percent" }> = {
  no_takeout: { emoji: "🥡", title: "Méně jídla z venku", unit: "money" },
  no_spend_days: { emoji: "🧘", title: "Dny bez utrácení", unit: "days" },
  save_amount: { emoji: "🐷", title: "Odložit na spoření", unit: "money" },
  category_cut: { emoji: "✂️", title: "Utratit méně v kategorii", unit: "percent" },
  daily_log: { emoji: "✍️", title: "Zapisovat každý den", unit: "days" },
};

export interface ChallengeState {
  challenge: Pick<Challenge, "kind" | "month" | "target" | "category_id"> & { id?: string };
  emoji: string; title: string; detail: string;
  value: number; target: number; unit: "money" | "days" | "percent";
  /** done = splněno, failed = už nejde splnit, active = běží. */
  status: "done" | "failed" | "active";
  /** 0–100 pro ukazatel. */
  percent: number;
}

interface Input { txs: readonly Transaction[]; categories: readonly Category[]; contributions: readonly SavingsContribution[]; today: ISODate }

const kc = (c: Cents) => formatMoney(c, { decimals: "never" });

export function evaluateChallenge(ch: ChallengeState["challenge"], d: Input): ChallengeState {
  const meta = CHALLENGE_META[ch.kind];
  const from = `${ch.month}-01` as ISODate;
  const to = endOfMonth(from);
  const until = d.today < to ? d.today : to;
  const over = d.today > to;
  const exp = d.txs.filter((t) => t.status === "posted" && t.type === "expense" && t.date >= from && t.date <= to);
  const base = { challenge: ch, emoji: meta.emoji, unit: meta.unit };
  switch (ch.kind) {
    case "no_takeout": {
      const ids = new Set(takeoutCategories(d.categories).map((c) => c.id));
      const spent = exp.filter((t) => t.category_id && ids.has(t.category_id)).reduce((a, t) => a + t.amount, 0);
      const failed = spent > ch.target;
      return { ...base, title: ch.target ? `Jídlo z venku nejvýš za ${kc(ch.target)}` : "Měsíc bez jídla z venku", detail: `Utraceno ${kc(spent)}${ids.size ? "" : " – založte kategorii Restaurace"}`, value: spent, target: ch.target,
        status: failed ? "failed" : over ? "done" : "active", percent: ch.target ? Math.min(100, Math.round((spent / ch.target) * 100)) : failed ? 100 : 0 };
    }
    case "no_spend_days": {
      const discretionary = new Set(exp.filter((t) => !t.recurring_payment_id).map((t) => t.date));
      let days = 0, passed = 0;
      for (let x = from; x <= until; x = addDays(x, 1)) { passed++; if (!discretionary.has(x)) days++; }
      const total = Number(to.slice(8));
      const possible = days + (total - passed);
      return { ...base, title: `${ch.target} dní bez utrácení`, detail: `Zatím ${days} dní bez výdaje (pravidelné platby se nepočítají)`, value: days, target: ch.target,
        status: days >= ch.target ? "done" : possible < ch.target || over ? "failed" : "active", percent: Math.min(100, Math.round((days / Math.max(1, ch.target)) * 100)) };
    }
    case "save_amount": {
      const saved = d.contributions.filter((c) => c.date >= from && c.date <= to).reduce((a, c) => a + c.amount, 0);
      return { ...base, title: `Odložit ${kc(ch.target)}`, detail: `Odloženo ${kc(Math.max(0, saved))}`, value: Math.max(0, saved), target: ch.target,
        status: saved >= ch.target ? "done" : over ? "failed" : "active", percent: Math.min(100, Math.round((Math.max(0, saved) / Math.max(1, ch.target)) * 100)) };
    }
    case "category_cut": {
      const cat = d.categories.find((c) => c.id === ch.category_id);
      const pf = addMonths(from, -1), pt = endOfMonth(pf);
      const prev = d.txs.filter((t) => t.status === "posted" && t.type === "expense" && t.category_id === ch.category_id && t.date >= pf && t.date <= pt).reduce((a, t) => a + t.amount, 0);
      const spent = exp.filter((t) => t.category_id === ch.category_id).reduce((a, t) => a + t.amount, 0);
      const limit = Math.round((prev * (100 - ch.target)) / 100);
      return { ...base, title: `${cat?.name ?? "Kategorie"} o ${ch.target} % méně`, detail: `Utraceno ${kc(spent)} z limitu ${kc(limit)} (minulý měsíc ${kc(prev)})`, value: spent, target: limit,
        status: spent > limit ? "failed" : over ? "done" : "active", percent: Math.min(100, Math.round((spent / Math.max(1, limit)) * 100)) };
    }
    case "daily_log": {
      const inMonth = d.txs.filter((t) => { const day = t.created_at.slice(0, 10); return day >= from && day <= to; });
      const s = recordingStreak(inMonth, until);
      return { ...base, title: `Zapisovat ${ch.target} dní v řadě`, detail: `Nejdelší série tento měsíc: ${s.best} dní`, value: s.best, target: ch.target,
        status: s.best >= ch.target ? "done" : over ? "failed" : "active", percent: Math.min(100, Math.round((s.best / Math.max(1, ch.target)) * 100)) };
    }
  }
}

/** Návrhy výzev na míru (z dat minulého měsíce). */
export function suggestChallenges(d: Input, existing: readonly Pick<Challenge, "kind">[]): ChallengeState["challenge"][] {
  const month = d.today.slice(0, 7);
  const pf = addMonths(`${month}-01`, -1), pt = endOfMonth(pf);
  const prevExp = d.txs.filter((t) => t.status === "posted" && t.type === "expense" && t.date >= pf && t.date <= pt);
  const out: ChallengeState["challenge"][] = [];
  const takeIds = new Set(takeoutCategories(d.categories).map((c) => c.id));
  const takeoutPrev = prevExp.filter((t) => t.category_id && takeIds.has(t.category_id)).reduce((a, t) => a + t.amount, 0);
  out.push({ kind: "no_takeout", month, target: takeoutPrev > 0 ? Math.round(takeoutPrev / 2 / 10_000) * 10_000 : 0, category_id: null });
  out.push({ kind: "no_spend_days", month, target: 8, category_id: null });
  const byCat = new Map<string, number>();
  for (const t of prevExp) if (t.category_id && !t.recurring_payment_id && !takeIds.has(t.category_id)) byCat.set(t.category_id, (byCat.get(t.category_id) ?? 0) + t.amount);
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) out.push({ kind: "category_cut", month, target: 15, category_id: top[0] });
  out.push({ kind: "save_amount", month, target: 200_000, category_id: null });
  out.push({ kind: "daily_log", month, target: 7, category_id: null });
  return out.filter((c) => !existing.some((e) => e.kind === c.kind));
}
