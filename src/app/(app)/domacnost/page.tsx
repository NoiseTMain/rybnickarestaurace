import { requireContext } from "@/lib/context";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { loadData } from "@/lib/data";
import { endOfMonth, monthName, todayISO, addMonths } from "@/lib/dates";
import { percent, sum } from "@/lib/money";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Progress } from "@/components/ui/Progress";
import { MonthPicker } from "@/components/lists/Filters";
import { TxRow } from "@/components/lists/TxRow";
import { TransactionButton } from "@/components/forms/TransactionForm";
import { SetupButton } from "@/components/forms/SetupForms";
import { RecurringButton } from "@/components/forms/PaymentForms";
import { CategoryDonut } from "@/components/charts/Charts";

export const metadata = { title: "Domácnost" };

export default async function HouseholdPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const data = await loadData(ctx);
  const month = /^\d{4}-\d{2}$/.test(sp.mesic ?? "") ? sp.mesic! : todayISO().slice(0, 7);
  const from = `${month}-01`;
  const to = endOfMonth(from);
  const prevFrom = addMonths(from, -1);
  const hhCats = new Set(data.categories.filter((c) => c.is_household).map((c) => c.id));
  const expenses = data.transactions.filter((t) => t.status === "posted" && t.type === "expense" && t.date >= from && t.date <= to);
  const household = expenses.filter((t) => t.category_id && hhCats.has(t.category_id));
  const prevHousehold = data.transactions.filter((t) => t.status === "posted" && t.type === "expense" && t.date >= prevFrom && t.date <= endOfMonth(prevFrom) && t.category_id && hhCats.has(t.category_id));
  const total = sum(household, (t) => t.amount);
  const shared = sum(expenses.filter((t) => t.scope === "shared"), (t) => t.amount);
  const personal = sum(expenses.filter((t) => t.scope === "personal"), (t) => t.amount);
  const allExpense = shared + personal;

  const byCat = data.categories.filter((c) => c.is_household && c.kind === "expense").map((c) => ({
    c, amount: sum(household.filter((t) => t.category_id === c.id), (t) => t.amount), prev: sum(prevHousehold.filter((t) => t.category_id === c.id), (t) => t.amount),
  })).filter((x) => x.amount > 0 || x.prev > 0).sort((a, b) => b.amount - a.amount);

  const byMember = [...data.members.map((m) => ({ id: m.id as string | null, name: m.name, color: m.color, avatar_document_id: m.avatar_document_id, phone: m.phone })), { id: null, name: "Nezadáno", color: "#6b665e", avatar_document_id: null, phone: null }].map((m) => {
    const mine = expenses.filter((t) => t.member_id === m.id);
    return { ...m, shared: sum(mine.filter((t) => t.scope === "shared"), (t) => t.amount), personal: sum(mine.filter((t) => t.scope === "personal"), (t) => t.amount),
      income: sum(data.transactions.filter((t) => t.status === "posted" && t.type === "income" && t.member_id === m.id && t.date >= from && t.date <= to), (t) => t.amount) };
  }).filter((m) => m.shared + m.personal + m.income > 0 || m.id);

  const children = data.members.filter((m) => m.is_child && m.is_active).map((m) => ({
    m,
    spent: sum(expenses.filter((t) => t.member_id === m.id), (t) => t.amount),
    goals: data.goals.filter((g) => g.member_id === m.id && g.status === "active").map((g) => ({ g, saved: sum(data.contributions.filter((c) => c.goal_id === g.id), (c) => c.amount) })),
  }));

  return (
    <div className="space-y-4">
      <ReadOnlyNotice ctx={ctx} section="finance" />
      <PageHeader title="Domácnost" subtitle={`Rodinný rozpočet · ${monthName(from)}`} actions={<><MonthPicker value={month} /><TransactionButton defaultType="expense" label="Přidat výdaj" variant="primary" /></>} />

      {children.length > 0 && (
        <Card title="Děti" subtitle="Kapesné, výdaje na děti tento měsíc a jejich spořicí cíle" data-testid="kids">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {children.map((k) => (
              <div key={k.m.id} className="rounded-2xl bg-black/25 p-3">
                <div className="flex items-center gap-2"><Avatar member={k.m} size={28} /><b className="text-sm">{k.m.name}</b></div>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-ink-2">Kapesné</span><span>{k.m.pocket_money ? <><Money value={k.m.pocket_money} decimals="never" /> / {k.m.pocket_frequency === "weekly" ? "týden" : "měsíc"}</> : <span className="text-ink-3">nenastaveno</span>}</span></div>
                  {k.m.pocket_frequency === "weekly" && k.m.pocket_money ? <div className="flex justify-between text-xs text-ink-3"><span>měsíčně cca</span><Money value={Math.round((k.m.pocket_money * 52) / 12)} decimals="never" /></div> : null}
                  <div className="flex justify-between"><span className="text-ink-2">Výdaje na dítě</span><Money value={k.spent} decimals="never" /></div>
                  {k.goals.map((g) => <div key={g.g.id}><div className="flex justify-between text-xs"><span>🎯 {g.g.name}</span><span><Money value={g.saved} decimals="never" /> / <Money value={g.g.target_amount} decimals="never" /></span></div><Progress value={percent(g.saved, g.g.target_amount || 1)} label={g.g.name} /></div>)}
                </div>
                {k.m.pocket_money && !data.recurring.some((r) => r.is_active && r.name === `Kapesné – ${k.m.name}`) ? (
                  <div className="mt-2"><RecurringButton label="Hlídat kapesné v plánu" prefill={{ name: `Kapesné – ${k.m.name}`, amount: k.m.pocket_money, frequency: k.m.pocket_frequency === "weekly" ? "weekly" : "monthly", start_date: todayISO(), member_id: k.m.id, payment_method: "cash" }} /></div>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-3">Tip: dítěti založte spořicí cíl (Spoření → Nový cíl → Pro koho) – naučí se, že na větší věc se šetří.</p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Domácí výdaje" subtitle={`${household.length} výdajů`}>
          <Money value={total} className="text-3xl font-semibold" decimals="never" />
          <p className="mt-1 text-xs text-ink-3">minulý měsíc <Money value={sum(prevHousehold, (t) => t.amount)} decimals="never" /></p>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-ink-2">Společné výdaje</span><Money value={shared} decimals="never" /></div>
            <Progress value={percent(shared, allExpense || 1)} label="Podíl společných výdajů" />
            <div className="flex justify-between text-sm"><span className="text-ink-2">Osobní výdaje</span><Money value={personal} decimals="never" /></div>
          </div>
        </Card>
        <Card title="Podle kategorií" className="lg:col-span-2">
          <CategoryDonut data={byCat.map((x) => ({ name: x.c.name, amount: x.amount }))} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Kdo platil" subtitle="Všechny výdaje měsíce podle člena">
          <ul className="space-y-3">
            {byMember.map((m) => (
              <li key={m.id ?? "none"} className="rounded-2xl bg-white/[0.04] p-3">
                <div className="flex items-center gap-2"><Avatar member={m} size={28} /><span className="flex-1 text-sm">{m.name}{m.phone && <a href={`tel:${m.phone.replace(/\s/g, "")}`} className="ml-2 text-xs text-gold">{m.phone}</a>}</span><Money value={m.shared + m.personal} decimals="never" className="text-sm font-semibold" /></div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-3"><span>společné <Money value={m.shared} decimals="never" /></span><span>osobní <Money value={m.personal} decimals="never" /></span><span>příjmy <Money value={m.income} decimals="never" /></span></div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Kategorie domácnosti" subtitle="Srovnání s minulým měsícem" className="lg:col-span-2" action={<SetupButton kind="category" label="Nová kategorie" />}>
          <ul className="divide-y divide-white/[0.05]">
            {data.categories.filter((c) => c.kind === "expense").map((c) => {
              const row = byCat.find((x) => x.c.id === c.id);
              const diff = (row?.amount ?? 0) - (row?.prev ?? 0);
              return (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                  <span className="hidden gap-1 sm:flex">{c.is_food && <Badge tone="gold">jídlo</Badge>}{c.is_household && <Badge>domácnost</Badge>}{c.is_archived && <Badge tone="danger">archiv</Badge>}</span>
                  <Money value={row?.amount ?? 0} decimals="never" className="w-24 text-right text-sm" />
                  <span className={`w-20 text-right text-xs ${diff > 0 ? "text-neg" : diff < 0 ? "text-pos" : "text-ink-3"}`}>{diff ? <Money value={diff} sign decimals="never" /> : "—"}</span>
                  <SetupButton kind="category" initial={c} size="icon" variant="ghost" />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card title="Výdaje domácnosti" subtitle="Seznam za vybraný měsíc" >
        {household.length ? <ul className="-mx-4 divide-y divide-white/[0.04] sm:-mx-5">{household.map((t) => <TxRow key={t.id} t={t} />)}</ul> : <div><EmptyState title="Žádné domácí výdaje v tomto měsíci" /></div>}
      </Card>
    </div>
  );
}
