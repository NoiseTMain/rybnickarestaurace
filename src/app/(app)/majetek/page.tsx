import Link from "next/link";
import { Check, Trash2 } from "lucide-react";
import { requireContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { ASSET_KIND_LABEL, REMINDER_KIND, dueReminders, netWorth } from "@/lib/finance/networth";
import { completeReminder, deleteAsset, deleteDebt, deleteReminder } from "@/lib/actions/wealth";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { ActionButton } from "@/components/ui/ActionButton";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { AssetButton, DebtButton, ReminderButton } from "@/components/forms/WealthForms";
import { NetWorthChart } from "@/components/charts/Charts";
import { DebtPlanner } from "@/components/DebtPlanner";
import { KV } from "@/components/dashboard/bits";

export const metadata = { title: "Majetek a dluhy" };

const daysText = (d: number) => d < 0 ? `${-d} dní po termínu` : d === 0 ? "dnes" : d === 1 ? "zítra" : `za ${d} dní`;

export default async function WealthPage() {
  const ctx = await requireContext();
  const hid = { household_id: ctx.household.id };
  const [{ snapshot: s, data, today }, assets, debts, history, reminders] = await Promise.all([
    loadSnapshot(ctx), ctx.store.select("assets", hid), ctx.store.select("debts", hid), ctx.store.select("net_worth_snapshots", hid), ctx.store.select("reminders", hid),
  ]);
  const nw = netWorth(s.balance.total, assets, debts);
  const month = today.slice(0, 7);
  const chart = [...history.filter((h) => h.month !== month), { month, assets: nw.assets, liabilities: nw.liabilities }]
    .sort((a, b) => a.month.localeCompare(b.month)).slice(-24).map((h) => ({ month: h.month, assets: h.assets, liabilities: h.liabilities, net: h.assets - h.liabilities }));
  const prev = chart.length > 1 ? chart[chart.length - 2] : null;
  const recurringDebts = data.recurring.filter((r) => r.is_debt && r.is_active && !debts.some((d) => d.name.toLowerCase() === r.name.toLowerCase()));
  const due = dueReminders(reminders, today);
  const active = reminders.filter((r) => !r.done).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const doneList = reminders.filter((r) => r.done);

  return (
    <div className="space-y-4">
      <ReadOnlyNotice ctx={ctx} section="finance" />
      <PageHeader title="Majetek, dluhy a termíny" subtitle="Čisté jmění, plán splacení dluhů a hlídání důležitých termínů" actions={<><ReminderButton today={today} label="Termín" size="md" /><DebtButton label="Dluh" size="md" /><AssetButton label="Majetek" variant="primary" size="md" /></>} />
      <nav className="flex flex-wrap gap-2 text-sm">
        {[["#jmeni", "Čisté jmění"], ["#dluhy", "Plán splacení"], ["#terminy", `Termíny${due.length ? ` (${due.length})` : ""}`], ["/dane", "Daně OSVČ"]].map(([h, l]) => <Link key={h} href={h} className="rounded-full bg-white/[0.06] px-3 py-1 hover:bg-white/10">{l}</Link>)}
      </nav>

      <Card id="jmeni" variant="light" title="Čisté jmění" subtitle="Co vlastníte minus co dlužíte">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-2">Čisté jmění</p>
            <p className={`num text-3xl font-semibold ${nw.net < 0 ? "text-neg" : "gold-text"}`} data-testid="net-worth">{formatMoney(nw.net, { decimals: "never" })}</p>
            {prev && <p className="text-xs text-ink-3">oproti {prev.month}: <span className={chart.at(-1)!.net >= prev.net ? "text-pos" : "text-neg"}>{chart.at(-1)!.net >= prev.net ? "+" : ""}{formatMoney(chart.at(-1)!.net - prev.net, { decimals: "never" })}</span></p>}
            <div className="mt-3">
              <KV k="Účty a hotovost" v={<Money value={nw.accounts} />} />
              <KV k="Majetek" v={<Money value={nw.assetSum} />} />
              <KV k="Dluhy" v={<Money value={-nw.liabilities} />} />
            </div>
          </div>
          <div className="lg:col-span-2">{chart.length > 1 ? <NetWorthChart data={chart} /> : <p className="text-sm text-ink-3">Graf vývoje se začne kreslit od příštího měsíce – stav se ukládá automaticky při každé změně majetku nebo dluhu.</p>}</div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Majetek" subtitle="Investice, nemovitosti, auta, penzijko">
          {assets.length ? (
            <ul className="divide-y divide-white/[0.06]">
              {assets.sort((a, b) => b.value - a.value).map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.name}</p><p className="text-xs text-ink-3">{ASSET_KIND_LABEL[a.kind]} · aktualizováno {formatDate((a.updated_at ?? a.created_at).slice(0, 10))}</p></div>
                  <Money value={a.value} decimals="never" />
                  <AssetButton initial={a} size="icon" variant="ghost" />
                  <ActionButton action={deleteAsset.bind(null, a.id)} confirm={`Smazat „${a.name}“?`} size="icon" icon={<Trash2 className="h-3.5 w-3.5" />} />
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Zatím žádný majetek">Přidejte investice, byt nebo auto – uvidíte své skutečné čisté jmění.</EmptyState>}
        </Card>
        <Card title="Dluhy" subtitle="Hypotéka, úvěry, kreditní karty">
          {debts.length ? (
            <ul className="divide-y divide-white/[0.06]">
              {debts.sort((a, b) => b.rate - a.rate).map((d) => (
                <li key={d.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.name}</p><p className="text-xs text-ink-3">{String(d.rate).replace(".", ",")} % ročně · splátka {formatMoney(d.min_payment, { decimals: "never" })}</p></div>
                  <Money value={d.balance} decimals="never" />
                  <DebtButton initial={d} size="icon" variant="ghost" />
                  <ActionButton action={deleteDebt.bind(null, d.id)} confirm={`Smazat „${d.name}“?`} size="icon" icon={<Trash2 className="h-3.5 w-3.5" />} />
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Žádné dluhy">Skvělé! Pokud nějaké máte, přidejte je – spočítáme nejrychlejší cestu ke splacení.</EmptyState>}
          {recurringDebts.length > 0 && <p className="mt-2 text-xs text-ink-3">V Pravidelných platbách máte splátky: {recurringDebts.map((r) => r.name).join(", ")}. Pro plán splacení je přidejte sem i se zůstatkem a úrokem.</p>}
        </Card>
      </div>

      <Card id="dluhy" title="Plán splacení dluhů" subtitle="Lavina vs. sněhová koule – kdy budete bez dluhů a kolik zaplatíte na úrocích">
        {debts.some((d) => d.balance > 0) ? <DebtPlanner debts={debts.map((d) => ({ id: d.id, name: d.name, balance: d.balance, rate: d.rate, min_payment: d.min_payment }))} today={today} /> : <p className="text-sm text-ink-3">Přidejte dluh se zůstatkem, úrokem a splátkou.</p>}
      </Card>

      <Card id="terminy" title="Hlídač termínů" subtitle="Záruky, STK, pojištění, konec fixace, doklady – upozorníme včas (i notifikací v Premium)">
        {active.length ? (
          <ul className="divide-y divide-white/[0.06]" data-testid="reminders">
            {active.map((r) => {
              const d = due.find((x) => x.id === r.id);
              return (
                <li key={r.id} className="flex items-center gap-2 py-2">
                  <span className="text-lg" aria-hidden>{REMINDER_KIND[r.kind].emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-ink-3">{REMINDER_KIND[r.kind].label} · {formatDate(r.due_date)}{r.repeat_yearly ? " · každý rok" : ""}</p>
                  </div>
                  {d && <Badge tone={d.daysLeft < 0 ? "danger" : "warning"}>{daysText(d.daysLeft)}</Badge>}
                  <ActionButton action={completeReminder.bind(null, r.id)} size="icon" icon={<Check className="h-3.5 w-3.5" />} />
                  <ReminderButton initial={r} today={today} size="icon" variant="ghost" />
                  <ActionButton action={deleteReminder.bind(null, r.id)} confirm={`Smazat „${r.title}“?`} size="icon" icon={<Trash2 className="h-3.5 w-3.5" />} />
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title="Žádné hlídané termíny">Přidejte STK, konec záruky nebo pojištění – nic vám neuteče.</EmptyState>}
        {doneList.length > 0 && <details className="mt-2 text-xs text-ink-3"><summary className="cursor-pointer">Vyřízené ({doneList.length})</summary><ul className="mt-1 space-y-1">{doneList.map((r) => <li key={r.id} className="flex items-center gap-2">{r.title} · {formatDate(r.due_date)}<ActionButton action={completeReminder.bind(null, r.id)} size="sm">Vrátit</ActionButton></li>)}</ul></details>}
      </Card>
    </div>
  );
}
