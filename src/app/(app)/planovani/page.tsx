import { requireContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { formatMoney, sum } from "@/lib/money";
import { checkAffordability } from "@/lib/finance/affordability";
import { purchaseQueue } from "@/lib/finance/purchase-queue";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { FilterTabs } from "@/components/lists/Filters";
import { PurchaseCard } from "@/components/lists/PurchaseCard";
import { PurchaseButton } from "@/components/forms/PurchaseForms";
import { ShoppingListButton, ShoppingListCard } from "@/components/forms/ShoppingForms";

export const metadata = { title: "Plánování" };

export default async function PlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const { data, snapshot: s, today } = await loadSnapshot(ctx);
  const tab = sp.tab ?? "";
  const f = s.food;

  if (tab === "domov") {
    const home = data.purchases.filter((p) => p.kind === "home");
    const rooms = [...new Set(home.map((p) => p.room).filter((r): r is string => Boolean(r)))].sort((a, b) => a.localeCompare(b, "cs"));
    const room = sp.mistnost ?? "";
    const active = home.filter((p) => p.status !== "bought" && (!room || p.room === room));
    const bought = home.filter((p) => p.status === "bought" && (!room || p.room === room));
    const queue = purchaseQueue(data.purchases);
    const card = (p: (typeof home)[number]) => {
      const r = p.status !== "bought" ? checkAffordability({ price: p.price, safeToSpend: s.planner.safeToSpend, queuedBefore: queue.get(p.id) ?? 0, monthlySurplus: s.monthlySurplus.amount, today }) : null;
      return <PurchaseCard key={p.id} p={p} r={r} categoryName={data.categories.find((c) => c.id === p.category_id)?.name} queued={(queue.get(p.id) ?? 0) > 0} />;
    };
    return (
      <div className="space-y-4">
        <PageHeader title="Plánování" subtitle="Nábytek a vybavení domácnosti – s fotkou, odkazem a kontrolou, zda si to můžete dovolit" actions={<PurchaseButton kind="home" label="Přidat věc" variant="primary" size="md" />} />
        <FilterTabs name="tab" options={[{ value: "", label: "Nákup jídla" }, { value: "domov", label: "Nábytek a vybavení", count: home.filter((p) => p.status !== "bought").length }]} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Plánováno celkem</p><Money value={sum(home.filter((p) => p.status !== "bought"), (p) => p.price)} decimals="never" className="text-xl font-semibold" /></Card>
          <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Bezpečně k utracení</p><Money value={s.planner.safeToSpend} decimals="never" className="gold-text text-xl font-semibold" /></Card>
          <Card className="col-span-2 !p-4 lg:col-span-1"><p className="text-[11px] uppercase tracking-wider text-ink-3">Koupeno</p><Money value={sum(home.filter((p) => p.status === "bought"), (p) => p.price)} decimals="never" className="text-xl font-semibold" /></Card>
        </div>
        {rooms.length > 0 && <FilterTabs name="mistnost" options={[{ value: "", label: "Všechny místnosti" }, ...rooms.map((r) => ({ value: r, label: r, count: home.filter((p) => p.room === r && p.status !== "bought").length }))]} />}
        {active.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{active.map(card)}</div> : (
          <Card><EmptyState title="Zatím nic naplánováno" action={<PurchaseButton kind="home" label="Přidat první věc" variant="primary" />}>Vložte odkaz na produkt (IKEA, Mobelix, Alza…) – fotku, název a cenu načteme automaticky. Nebo věc vyfoťte v obchodě.</EmptyState></Card>
        )}
        {bought.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm text-ink-2">Koupeno ({bought.length})</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{bought.map(card)}</div>
          </details>
        )}
      </div>
    );
  }

  const [lists, items] = await Promise.all([
    ctx.store.select("shopping_lists", { household_id: ctx.household.id }),
    ctx.store.select("shopping_items", { household_id: ctx.household.id }),
  ]);
  const spentByList = new Map(data.transactions.filter((t) => t.status === "posted" && t.shopping_list_id).map((t) => [t.shopping_list_id!, t.amount]));
  const open = lists.filter((l) => l.status === "open").sort((a, b) => (a.planned_date ?? "9999").localeCompare(b.planned_date ?? "9999"));
  const done = lists.filter((l) => l.status === "done").sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
  const itemsOf = (id: string) => items.filter((i) => i.list_id === id).sort((a, b) => Number(a.checked) - Number(b.checked) || a.sort - b.sort);
  const plannedTotal = sum(open.flatMap((l) => itemsOf(l.id)), (i) => i.est_price ?? 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Plánování" subtitle="Nákupní seznamy jídla napojené na rozpočet" actions={<ShoppingListButton label="Nový seznam" />} />
      <FilterTabs name="tab" options={[{ value: "", label: "Nákup jídla", count: open.length }, { value: "domov", label: "Nábytek a vybavení", count: data.purchases.filter((p) => p.kind === "home" && p.status !== "bought").length }]} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Na jídlo zbývá</p>{f ? <Money value={f.remaining} decimals="never" colored={f.remaining < 0} className="text-xl font-semibold" /> : <p className="text-sm text-ink-3">rozpočet nenastaven</p>}</Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Do konce týdne</p>{f ? <Money value={f.weekLimit} decimals="never" className="text-xl font-semibold" /> : <p className="text-sm text-ink-3">—</p>}</Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Denní limit</p>{f ? <Money value={f.dailyLimit} decimals="never" className="text-xl font-semibold" /> : <p className="text-sm text-ink-3">—</p>}</Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Naplánováno v seznamech</p><Money value={plannedTotal} decimals="never" className="text-xl font-semibold" />{f && plannedTotal > f.remaining && <p className="text-[11px] text-neg">o {formatMoney(plannedTotal - f.remaining, { decimals: "never" })} víc než zbývá</p>}</Card>
      </div>
      {open.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {open.map((l) => <ShoppingListCard key={l.id} list={l} items={itemsOf(l.id)} weekLimit={f?.weekLimit ?? null} remaining={f?.remaining ?? null} spent={null} />)}
        </div>
      ) : (
        <Card><EmptyState title="Žádný otevřený nákupní seznam" action={<ShoppingListButton label="Vytvořit seznam" />}>Sepište, co koupit, odhadněte ceny a uvidíte, jestli se nákup vejde do rozpočtu na jídlo. Po nákupu stačí zadat částku z účtenky.</EmptyState></Card>
      )}
      {done.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-ink-2">Nedávno nakoupeno</h2>
          <div className="grid gap-4 lg:grid-cols-2">{done.map((l) => <ShoppingListCard key={l.id} list={l} items={itemsOf(l.id)} weekLimit={null} remaining={null} spent={spentByList.get(l.id) ?? null} />)}</div>
        </div>
      )}
    </div>
  );
}
