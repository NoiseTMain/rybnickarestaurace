"use client";
import { Bookmark, ChefHat, Heart } from "lucide-react";
import { useState, useTransition } from "react";
import { markCooked, toggleRecipe } from "@/lib/actions/recipes";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";

/** Srdíčko (lajk) a záložka (uložit) – na kartě i v detailu. Optimisticky, bez čekání na server. */
export function RecipeActions({ id, liked, saved, likes, cooked, compact = false }: { id: string; liked: boolean; saved: boolean; likes: number; cooked?: number; compact?: boolean }) {
  const [st, setSt] = useState({ liked, saved, likes, cooked: cooked ?? 0 });
  const [, start] = useTransition();
  const toast = useToast();
  const toggle = (field: "liked" | "saved", e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setSt((s) => field === "liked" ? { ...s, liked: !s.liked, likes: s.likes + (s.liked ? -1 : 1) } : { ...s, saved: !s.saved });
    start(async () => { const r = await toggleRecipe(id, field); if (!r.ok) toast(r.error ?? "Chyba", "error"); else if (!compact) toast(r.message ?? ""); });
  };
  const btn = "flex items-center gap-1 rounded-full transition";
  if (compact) {
    return (
      <span className="flex items-center gap-1">
        <button type="button" onClick={(e) => toggle("liked", e)} className={cn(btn, "px-1.5 py-1 text-xs", st.liked ? "text-neg" : "text-ink-3 hover:text-ink")} aria-label={st.liked ? "Odebrat lajk" : "Líbí se mi"} aria-pressed={st.liked}>
          <Heart className={cn("h-4 w-4", st.liked && "fill-current")} />{st.likes > 0 && <span>{st.likes}</span>}
        </button>
        <button type="button" onClick={(e) => toggle("saved", e)} className={cn(btn, "p-1", st.saved ? "text-gold" : "text-ink-3 hover:text-ink")} aria-label={st.saved ? "Odebrat z Moje recepty" : "Uložit recept"} aria-pressed={st.saved}>
          <Bookmark className={cn("h-4 w-4", st.saved && "fill-current")} />
        </button>
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={(e) => toggle("liked", e)} className={cn(btn, "border px-3 py-1.5 text-sm", st.liked ? "border-neg/40 bg-neg/10 text-neg" : "border-white/10 text-ink-2 hover:text-ink")} aria-pressed={st.liked}>
        <Heart className={cn("h-4 w-4", st.liked && "fill-current")} />{st.liked ? "Líbí se mi" : "Lajknout"}{st.likes > 0 && <span className="opacity-70">· {st.likes}</span>}
      </button>
      <button type="button" onClick={(e) => toggle("saved", e)} className={cn(btn, "border px-3 py-1.5 text-sm", st.saved ? "border-gold/40 bg-gold/10 text-gold-bright" : "border-white/10 text-ink-2 hover:text-ink")} aria-pressed={st.saved}>
        <Bookmark className={cn("h-4 w-4", st.saved && "fill-current")} />{st.saved ? "Uloženo" : "Uložit do Moje recepty"}
      </button>
      <button type="button" onClick={() => { setSt((s) => ({ ...s, cooked: s.cooked + 1 })); start(async () => { const r = await markCooked(id); toast(r.ok ? r.message ?? "" : r.error ?? "Chyba", r.ok ? undefined : "error"); }); }} className={cn(btn, "border border-white/10 px-3 py-1.5 text-sm text-ink-2 hover:text-ink")}>
        <ChefHat className="h-4 w-4" />Uvařil(a) jsem{st.cooked > 0 && <span className="opacity-70">· {st.cooked}×</span>}
      </button>
    </div>
  );
}
