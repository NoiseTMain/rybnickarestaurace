import { notFound } from "next/navigation";
import { Clock, Flame, Users } from "lucide-react";
import { requireContext } from "@/lib/context";
import { getPremium } from "@/lib/premium";
import { COURSES } from "@/lib/recipes";
import { phrase } from "@/lib/i18n/phrase";
import { Card, PageHeader } from "@/components/ui/Card";
import { CustomIngredients, CustomRecipeButton, DeleteCustomRecipe } from "@/components/recipes/CustomRecipeForms";

export const metadata = { title: "Vlastní recept" };

export default async function CustomRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [rows, lists, premium] = await Promise.all([
    ctx.store.select("custom_recipes", { id, household_id: ctx.household.id }),
    ctx.store.select("shopping_lists", { household_id: ctx.household.id }).then((ls) => ls.filter((l) => l.status === "open").map((l) => ({ id: l.id, name: l.name }))),
    getPremium(ctx),
  ]);
  const r = rows[0];
  if (!r) notFound();
  const steps = (r.steps ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const c = COURSES[r.course];
  return (
    <div className="space-y-4">
      <PageHeader title={r.title} subtitle={`${c.emoji} ${phrase(c.label)} · ${phrase("Vlastní recept")}`}
        actions={premium.household ? <div className="flex gap-2"><CustomRecipeButton initial={r} /><DeleteCustomRecipe id={r.id} /></div> : <DeleteCustomRecipe id={r.id} />} />
      {r.photo_document_id ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/files/${r.photo_document_id}`} alt={r.title} className="aspect-[4/3] max-h-[420px] w-full rounded-[var(--radius-card)] border border-white/10 object-cover sm:aspect-[16/9]" data-testid="custom-photo" />
      ) : (
        <div className="flex aspect-[16/9] max-h-[260px] w-full items-center justify-center rounded-[var(--radius-card)] border border-dashed border-white/15 text-6xl" aria-hidden>{c.emoji}</div>
      )}
      <div className="flex flex-wrap gap-3 text-sm text-ink-2">
        <span className="flex items-center gap-1"><Users className="h-4 w-4" />{r.servings} {r.servings === 1 ? "porce" : r.servings < 5 ? "porce" : "porcí"}</span>
        {r.time_min && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{r.time_min} min</span>}
        {r.kcal != null && <span className="flex items-center gap-1"><Flame className="h-4 w-4 text-gold" />{r.kcal} kcal / porce</span>}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card title="Suroviny"><CustomIngredients r={r} lists={lists} /></Card>
        <Card title="Postup">
          {steps.length ? <ol className="space-y-3 text-sm">{steps.map((s, i) => <li key={i} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs text-gold">{i + 1}</span><span className="leading-relaxed">{s}</span></li>)}</ol> : <p className="text-sm text-ink-3">Postup zatím není vyplněný.</p>}
          {r.note && <p className="mt-4 rounded-xl bg-white/[0.04] p-3 text-sm text-ink-2">{r.note}</p>}
        </Card>
      </div>
    </div>
  );
}
