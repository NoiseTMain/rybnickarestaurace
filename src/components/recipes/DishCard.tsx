import Link from "next/link";
import { Clock, Crown, Flame } from "lucide-react";
import { COURSES, CUISINES, type Dish, type Recipe } from "@/lib/recipes";
import { phrase } from "@/lib/i18n/phrase";
import { formatMoney } from "@/lib/money";
import { RecipeActions } from "./RecipeActions";

export interface Reaction { liked: boolean; saved: boolean; cooked_count: number }

/** Karta jídla: jedno jídlo = jedna karta (varianty se vybírají v detailu). */
export function DishCard({ d, v, locked, reaction, likes, wide = false }: { d: Dish; v: Recipe; locked: boolean; reaction?: Reaction; likes: number; wide?: boolean }) {
  const href = v.id === d.def.id ? `/recepty/${d.id}` : `/recepty/${d.id}?a=${v.aKey}${v.bKey ? `&b=${v.bKey}` : ""}`;
  return (
    <Link href={href} className={`glass relative flex h-full flex-col rounded-[var(--radius-card)] p-4 transition hover:border-gold/40 ${wide ? "w-64 shrink-0 snap-start" : ""}`} data-testid="dish-card">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-2xl" aria-hidden>{COURSES[d.course].emoji}</span>
        <div className="flex items-center gap-1">
          {locked ? <Crown className="h-4 w-4 text-gold" aria-label="Premium" /> : d.free ? <span className="rounded-full bg-pos/15 px-2 py-0.5 text-[10px] text-pos">zdarma</span> : null}
          <RecipeActions id={d.id} liked={Boolean(reaction?.liked)} saved={Boolean(reaction?.saved)} likes={likes} compact />
        </div>
      </div>
      <p className="mt-2 line-clamp-2 font-medium leading-snug">{phrase(d.title)}</p>
      <p className="mt-0.5 text-xs text-ink-3">{CUISINES[d.cuisine].flag} {phrase(CUISINES[d.cuisine].label)} · {phrase(COURSES[d.course].label)}{d.variants.length > 1 ? ` · ${d.variants.length} ${phrase("variant")}` : ""}</p>
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-xs text-ink-2">
        <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-gold" />{v.kcal} kcal</span>
        <span>B {v.protein} g</span>
        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{v.time} min</span>
        <span>≈ {formatMoney(v.price, { decimals: "never" })}</span>
        {reaction?.cooked_count ? <span className="text-pos">✓ {reaction.cooked_count}×</span> : null}
      </div>
    </Link>
  );
}
