import Link from "next/link";
import { Clock, Crown, Flame } from "lucide-react";
import { COURSES, CUISINES, type Dish, type Recipe } from "@/lib/recipes";
import { phrase } from "@/lib/i18n/phrase";
import { formatMoney } from "@/lib/money";
import { RecipeActions } from "./RecipeActions";
import { recipeImage } from "@/lib/recipes/image";

export interface Reaction { liked: boolean; saved: boolean; cooked_count: number }

/** Karta jídla: jedno jídlo = jedna karta (varianty se vybírají v detailu). */
export function DishCard({ d, v, locked, reaction, likes, wide = false }: { d: Dish; v: Recipe; locked: boolean; reaction?: Reaction; likes: number; wide?: boolean }) {
  const href = v.id === d.def.id ? `/recepty/${d.id}` : `/recepty/${d.id}?a=${v.aKey}${v.bKey ? `&b=${v.bKey}` : ""}`;
  return (
    <Link href={href} className={`glass relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] transition hover:border-gold/40 ${wide ? "w-64 shrink-0 snap-start" : ""}`} data-testid="dish-card">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={recipeImage(v.id)} alt={phrase(d.title)} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        <div className="absolute left-2 top-2 flex items-center gap-1">
          <span className="rounded-full bg-black/55 px-2 py-0.5 text-xs backdrop-blur" aria-hidden>{COURSES[d.course].emoji}</span>
          {locked ? <span className="rounded-full bg-black/55 p-1 backdrop-blur"><Crown className="h-3.5 w-3.5 text-gold" aria-label="Premium" /></span> : d.free ? <span className="rounded-full bg-pos/80 px-2 py-0.5 text-[10px] text-white">zdarma</span> : null}
        </div>
        <div className="absolute right-2 top-2 rounded-full bg-black/55 px-1 backdrop-blur"><RecipeActions id={d.id} liked={Boolean(reaction?.liked)} saved={Boolean(reaction?.saved)} likes={likes} compact /></div>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4">
      <p className="mt-2 line-clamp-2 font-medium leading-snug">{phrase(d.title)}</p>
      <p className="mt-0.5 text-xs text-ink-3">{CUISINES[d.cuisine].flag} {phrase(CUISINES[d.cuisine].label)} · {phrase(COURSES[d.course].label)}{d.variants.length > 1 ? ` · ${d.variants.length} ${phrase("variant")}` : ""}</p>
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-xs text-ink-2">
        <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-gold" />{v.kcal} kcal</span>
        <span>B {v.protein} g</span>
        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{v.time} min</span>
        <span>≈ {formatMoney(v.price, { decimals: "never" })}</span>
        {reaction?.cooked_count ? <span className="text-pos">✓ {reaction.cooked_count}×</span> : null}
      </div>
      </div>
    </Link>
  );
}
