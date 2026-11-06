import { ExternalLink, Trash2, CheckCircle2, Clock } from "lucide-react";
import { requireContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { formatDate, monthName } from "@/lib/dates";
import { formatMoney, sum } from "@/lib/money";
import { checkAffordability } from "@/lib/finance/affordability";
import { PURCHASE_STATUS_LABEL } from "@/lib/defaults";
import { deletePurchase, setPurchaseStatus } from "@/lib/actions/purchases";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { ActionButton } from "@/components/ui/ActionButton";
import { FilterSelect, FilterTabs } from "@/components/lists/Filters";
import { BoughtButton, PurchaseButton } from "@/components/forms/PurchaseForms";
import type { Purchase } from "@/lib/db/types";

export const metadata = { title: "Nákupy" };

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const { data, snapshot: s, today } = await loadSnapshot(ctx);
  const tab = sp.tab ?? "";
  const sort = sp.razeni ?? "priorita";
  const active = data.purchases.filter((p) => p.status !== "bought");
  const byPriority = (a: Purchase, b: Purchase) => a.priority - b.priority || (a.planned_date ?? "9999").localeCompare(b.planned_date ?? "9999") || a.created_at.localeCompare(b.created_at);
  // fronta: nejdřív nutné nákupy podle priority, potom přání
  const queue = [...active.filter((p) => !p.is_wish).sort(byPriority), ...active.filter((p) => p.is_wish).sort(byPriority)];
  const queuedBefore = new Map<string, number>();
  let acc = 0;
  for (const p of queue) {
    queuedBefore.set(p.id, acc);
    acc += p.price;
  }
  const list = (tab === "koupeno" ? data.purchases.filter((p) => p.status === "bought") : tab === "prani" ? active.filter((p) => p.is_wish) : active.filter((p) => !p.is_wish))
    .sort(sort === "cena" ? (a, b) => b.price - a.price : sort === "datum" ? (a, b) => (a.planned_date ?? "9999").localeCompare(b.planned_date ?? "9999") : byPriority);
  const cat = (id: string | null) => data.categories.find((c) => c.id === id)?.name;

  return (
    <div className="space-y-4">
      <PageHeader title="Moje nákupy" subtitle="Plánované věci a seznam přání – s kontrolou, zda si je můžete dovolit" actions={<PurchaseButton label="Přidat nákup" variant="primary" size="md" />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Bezpečně k utracení</p><Money value={s.planner.safeToSpend} decimals="never" className="gold-text text-xl font-semibold" /></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Plánované nákupy</p><Money value={sum(active.filter((p) => !p.is_wish), (p) => p.price)} decimals="never" className="text-xl font-semibold" /></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Seznam přání</p><Money value={sum(active.filter((p) => p.is_wish), (p) => p.price)} decimals="never" className="text-xl font-semibold" /></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Měsíční přebytek</p>{s.monthlySurplus.amount != null ? <Money value={s.monthlySurplus.amount} decimals="never" colored className="text-xl font-semibold" /> : <p className="text-sm text-ink-3">zatím nelze určit</p>}<p className="text-[11px] text-ink-3">{s.monthlySurplus.basis === "history" ? `průměr ${s.monthlySurplus.months} měs. po plánu spoření` : s.monthlySurplus.basis === "plan" ? "podle plánovaných příjmů a výdajů" : ""}</p></Card>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterTabs name="tab" options={[{ value: "", label: "Nákupy", count: active.filter((p) => !p.is_wish).length }, { value: "prani", label: "Seznam přání", count: active.filter((p) => p.is_wish).length }, { value: "koupeno", label: "Koupeno", count: data.purchases.length - active.length }]} />
        <FilterSelect name="razeni" label="Řazení"><option value="">Podle priority</option><option value="cena">Podle ceny</option><option value="datum">Podle data</option></FilterSelect>
      </div>
      {list.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const r = p.status !== "bought" ? checkAffordability({ price: p.price, safeToSpend: s.planner.safeToSpend, queuedBefore: queuedBefore.get(p.id) ?? 0, monthlySurplus: s.monthlySurplus.amount, today }) : null;
            return (
              <Card key={p.id}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-ink-3">
                      <Badge tone={p.priority <= 2 ? "gold" : "neutral"}>priorita {p.priority}</Badge>
                      <Badge tone={p.status === "buying" ? "info" : p.status === "bought" ? "positive" : "neutral"}>{PURCHASE_STATUS_LABEL[p.status]}</Badge>
                      {cat(p.category_id) && <Badge>{cat(p.category_id)}</Badge>}
                      {p.planned_date && <span className="self-center">plán {formatDate(p.planned_date)}</span>}
                    </p>
                  </div>
                  <Money value={p.price} decimals="never" className="text-lg font-semibold" />
                </div>
                {r && (r.affordable ? (
                  <p className="mt-3 flex items-center gap-2 rounded-xl bg-pos/10 px-3 py-2 text-sm text-pos"><CheckCircle2 className="h-4 w-4 shrink-0" />Můžete si dovolit{(queuedBefore.get(p.id) ?? 0) > 0 && " (i po prioritnějších nákupech)"}.</p>
                ) : (
                  <div className="mt-3 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">
                    <p className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" />Chybí <b><Money value={r.shortfall} decimals="never" /></b> – tolik je potřeba ušetřit.</p>
                    <p className="mt-0.5 text-xs text-ink-2">{r.affordableFrom ? `Bezpečně přibližně od ${monthName(r.affordableFrom)} (za ${r.monthsNeeded} měs.). ${r.reason}` : r.reason}</p>
                  </div>
                ))}
                {p.note && <p className="mt-2 text-xs text-ink-2">{p.note}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-end gap-1">
                  {p.url && <a href={p.url} target="_blank" rel="noreferrer noopener" className="mr-auto flex items-center gap-1 text-xs text-gold hover:underline"><ExternalLink className="h-3.5 w-3.5" />Odkaz</a>}
                  {p.status === "planned" && <ActionButton action={setPurchaseStatus.bind(null, p.id, "buying")} size="sm">Kupuji</ActionButton>}
                  {p.status !== "bought" && <BoughtButton purchase={p} />}
                  <PurchaseButton initial={p} size="icon" variant="ghost" />
                  <ActionButton action={deletePurchase.bind(null, p.id)} confirm="Smazat nákup?" size="icon" icon={<Trash2 className="h-4 w-4" />} />
                </div>
              </Card>
            );
          })}
        </div>
      ) : <Card><EmptyState title={tab === "koupeno" ? "Zatím nic koupeno" : "Seznam je prázdný"} action={tab !== "koupeno" ? <PurchaseButton label="Přidat" variant="primary" /> : undefined} /></Card>}
      <p className="text-xs text-ink-3">Dostupnost se posuzuje proti penězům „bezpečně k utracení“ ({formatMoney(s.planner.safeToSpend)}) a počítá s tím, že prioritnější nákupy přijdou na řadu dřív. Očekávané příjmy se nezapočítávají.</p>
    </div>
  );
}
