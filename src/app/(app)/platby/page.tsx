import { Trash2 } from "lucide-react";
import { requireContext } from "@/lib/context";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { loadData } from "@/lib/data";
import { addDays, addMonths, daysInMonth, endOfMonth, formatDate, monthName, parts, startOfMonth, todayISO, weekday } from "@/lib/dates";
import { divRound, formatMoney, sum } from "@/lib/money";
import { FREQUENCY_LABEL, FREQUENCY_PER_MONTH } from "@/lib/finance/recurrence";
import { incomeOccurrences, recurringOccurrences, type OccurrenceState } from "@/lib/finance/obligations";
import { deleteRecurring } from "@/lib/actions/payments";
import { deleteSetupItem } from "@/lib/actions/setup";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge, type Tone } from "@/components/ui/Badge";
import { ActionButton } from "@/components/ui/ActionButton";
import { LinkButton } from "@/components/ui/Button";
import { PayOccurrenceButton, RecurringButton } from "@/components/forms/PaymentForms";
import { SetupButton } from "@/components/forms/SetupForms";
import { OccurrenceMenu } from "@/components/lists/OccurrenceActions";
import { cn } from "@/components/ui/cn";
import { detectSubscriptions } from "@/lib/finance/subscriptions";

export const metadata = { title: "Pravidelné platby" };

const STATE: Record<OccurrenceState, { label: string; tone: Tone }> = {
  paid: { label: "zaplaceno", tone: "positive" },
  paid_untracked: { label: "zaplaceno mimo", tone: "positive" },
  skipped: { label: "přeskočeno", tone: "neutral" },
  due: { label: "dnes", tone: "warning" },
  overdue: { label: "po splatnosti", tone: "danger" },
  upcoming: { label: "čeká", tone: "neutral" },
};

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const data = await loadData(ctx);
  const today = todayISO();
  const month = /^\d{4}-\d{2}$/.test(sp.mesic ?? "") ? `${sp.mesic}-01` : startOfMonth(today);
  const mEnd = endOfMonth(month);
  const occ = recurringOccurrences(data.recurring, data.transactions, data.marks, month, mEnd, today);
  const inc = incomeOccurrences(data.incomeSources, data.transactions, data.marks, month, mEnd, today);
  const marks = new Set(data.marks.map((m) => `${m.recurring_payment_id ?? m.income_source_id}|${m.occurrence_date}`));
  const open = occ.filter((o) => ["due", "overdue", "upcoming"].includes(o.state));
  const perMonth = sum(data.recurring.filter((r) => r.is_active), (r) => divRound(r.amount * FREQUENCY_PER_MONTH[r.frequency][0], FREQUENCY_PER_MONTH[r.frequency][1]));
  const debts = data.recurring.filter((r) => r.is_debt && r.is_active);
  const p = parts(month);
  const firstDow = (weekday(month) + 6) % 7;
  const cells = Array.from({ length: firstDow + daysInMonth(p.y, p.m) }, (_, i) => (i < firstDow ? null : addDays(month, i - firstDow)));
  const cat = (id: string | null) => data.categories.find((c) => c.id === id)?.name;
  const subs = detectSubscriptions(data.transactions, data.recurring, today);

  return (
    <div className="space-y-4">
      <ReadOnlyNotice ctx={ctx} section="finance" />
      <PageHeader title="Pravidelné platby a závazky" subtitle="Budoucí závazky se automaticky započítávají do finančního plánu." actions={<RecurringButton label="Nová platba" variant="primary" size="md" />} />

      {(subs.unknown.length > 0 || subs.increases.length > 0) && (
        <Card title="Hlídač předplatných" subtitle={`Z vašich plateb jsme našli ${subs.candidates.length} pravidelných – ročně ${formatMoney(subs.yearlyTotal, { decimals: "never" })}`} data-testid="subscriptions">
          {subs.increases.length > 0 && (
            <div className="mb-3 space-y-1">
              {subs.increases.map((i) => <p key={i.key} className="text-sm">📈 <b>{i.name}</b> zdražilo z {formatMoney(i.from)} na <b>{formatMoney(i.to)}</b> ({formatDate(i.date)}) – ročně o <span className="text-neg">{formatMoney(i.yearlyImpact, { decimals: "never" })}</span> víc. {i.recurringId && <>Upravte částku v pravidelné platbě.</>}</p>)}
            </div>
          )}
          {subs.unknown.length > 0 && (
            <>
              <p className="mb-1 text-xs text-ink-3">Tyto platby se opakují každý měsíc, ale nemáte je v pravidelných platbách. Přidejte je – plán s nimi bude počítat. Nepoužíváte je? Zrušte je a ušetříte.</p>
              <ul className="divide-y divide-white/[0.06]">
                {subs.unknown.map((c) => (
                  <li key={c.key} className="flex items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{c.name} <span className="text-ink-3">· {c.count}× · naposledy {formatDate(c.lastDate)}</span></span>
                    <span className="num">{formatMoney(c.amount)}/měs.</span>
                    <RecurringButton label="Přidat" prefill={{ name: c.name, amount: c.amount, frequency: "monthly", start_date: addMonths(c.lastDate, 1), payment_method: "card" }} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Měsíčně v průměru</p><Money value={perMonth} decimals="never" className="text-xl font-semibold" /></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Tento měsíc celkem</p><Money value={sum(occ.filter((o) => o.state !== "skipped"), (o) => o.amount)} decimals="never" className="text-xl font-semibold" /></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Zbývá zaplatit</p><Money value={sum(open, (o) => o.amount)} decimals="never" className="text-xl font-semibold text-gold" /></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Dluhy celkem</p><Money value={sum(debts, (d) => d.debt_remaining ?? 0)} decimals="never" className="text-xl font-semibold" /></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card title={`Kalendář · ${monthName(month)}`} action={
          <div className="flex gap-1">
            <LinkButton size="sm" variant="ghost" href={`/platby?mesic=${addMonths(month, -1).slice(0, 7)}`}>←</LinkButton>
            <LinkButton size="sm" variant="ghost" href="/platby">Dnes</LinkButton>
            <LinkButton size="sm" variant="ghost" href={`/platby?mesic=${addMonths(month, 1).slice(0, 7)}`}>→</LinkButton>
          </div>
        }>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-ink-3">{["po", "út", "st", "čt", "pá", "so", "ne"].map((d) => <div key={d}>{d}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const items = occ.filter((o) => o.date === d);
              const incomes = inc.filter((o) => o.date === d);
              return (
                <div key={d} className={cn("min-h-16 rounded-xl border p-1 text-left sm:min-h-20 sm:p-1.5", d === today ? "border-gold/60 bg-gold/10" : "border-white/[0.05] bg-white/[0.02]")}>
                  <div className="text-[11px] text-ink-3">{parts(d).d}</div>
                  {items.map((o) => (
                    <div key={o.key} title={`${o.name} ${formatMoney(o.amount)}`} className={cn("mt-0.5 truncate rounded px-1 text-[10px]", o.state === "paid" || o.state === "paid_untracked" ? "bg-pos/15 text-pos" : o.state === "overdue" ? "bg-neg/20 text-neg" : o.state === "skipped" ? "text-ink-3 line-through" : "bg-white/10 text-ink")}>{o.name}</div>
                  ))}
                  {incomes.map((o) => <div key={o.key} title={o.name} className="mt-0.5 truncate rounded bg-[#c98500]/20 px-1 text-[10px] text-gold-bright">+ {o.name}</div>)}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-3">Zeleně zaplacené, červeně po splatnosti, zlatě očekávané příjmy.</p>
        </Card>

        <Card title="Termíny v měsíci">
          {occ.length ? (
            <ul className="divide-y divide-white/[0.05]">
              {occ.map((o) => {
                const rp = data.recurring.find((r) => r.id === o.refId)!;
                return (
                  <li key={o.key} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{o.name}</p>
                      <p className="text-[11px] text-ink-3">{formatDate(o.date, "day")} · <Badge tone={STATE[o.state].tone}>{STATE[o.state].label}</Badge></p>
                    </div>
                    <Money value={o.amount} decimals="never" className="text-sm" />
                    {["due", "overdue", "upcoming"].includes(o.state) && <PayOccurrenceButton kind="recurring" refId={o.refId} name={o.name} occurrenceDate={o.date} amount={o.amount} accountId={rp.account_id} />}
                    {o.state !== "paid" && <OccurrenceMenu kind="recurring" refId={o.refId} date={o.date} marked={marks.has(o.key)} />}
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState title="Žádné platby v tomto měsíci" />}
        </Card>
      </div>

      <Card title="Všechny pravidelné platby">
        {data.recurring.length ? (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink-3"><tr><th className="px-4 py-2 font-medium sm:px-5">Název</th><th className="font-medium">Kategorie</th><th className="font-medium">Frekvence</th><th className="font-medium">Nejbližší nezaplacená</th><th className="text-right font-medium">Částka</th><th /></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {data.recurring.map((r) => (
                  <tr key={r.id} className={cn(!r.is_active && "opacity-50")}>
                    <td className="px-4 py-2.5 sm:px-5">{r.name} {r.is_debt && <Badge tone="warning">dluh{r.debt_remaining != null ? ` · zbývá ${formatMoney(r.debt_remaining, { decimals: "never" })}` : ""}</Badge>}{!r.is_active && <Badge>neaktivní</Badge>}</td>
                    <td className="text-ink-2">{cat(r.category_id) ?? "—"}</td>
                    <td className="text-ink-2">{FREQUENCY_LABEL[r.frequency]}</td>
                    <td className="text-ink-2">{formatDate(recurringOccurrences([r], data.transactions, data.marks, addDays(today, -45), addMonths(today, 13), today).find((o) => ["due", "overdue", "upcoming"].includes(o.state))?.date ?? null)}</td>
                    <td className="text-right"><Money value={r.amount} /></td>
                    <td className="whitespace-nowrap px-2 text-right"><RecurringButton initial={r} size="icon" variant="ghost" /><ActionButton action={deleteRecurring.bind(null, r.id)} confirm="Smazat pravidelnou platbu? Zaplacené transakce zůstanou." size="icon" icon={<Trash2 className="h-4 w-4" />} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Zatím žádné pravidelné platby" action={<RecurringButton label="Přidat první" variant="primary" />}>Nájem, energie, internet, telefon, předplatné, splátky, pojištění…</EmptyState>}
      </Card>

      <Card title="Očekávané pravidelné příjmy" subtitle="Do dostupných peněz se započtou až po potvrzení přijetí" action={<SetupButton kind="income" label="Přidat příjem" />}>
        {data.incomeSources.length ? (
          <ul className="divide-y divide-white/[0.05]">
            {data.incomeSources.map((src) => {
              const o = inc.filter((x) => x.refId === src.id);
              return (
                <li key={src.id} className="py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm">{src.name} <span className="text-xs text-ink-3">· {FREQUENCY_LABEL[src.frequency]}</span></span>
                    <Money value={src.amount} />
                    <SetupButton kind="income" initial={src} size="icon" variant="ghost" />
                    <ActionButton action={deleteSetupItem.bind(null, "income_sources", src.id)} confirm="Smazat zdroj příjmu? Přijaté transakce zůstanou." size="icon" icon={<Trash2 className="h-4 w-4" />} />
                  </div>
                  {o.map((x) => (
                    <div key={x.key} className="mt-1 flex items-center gap-2 pl-3 text-xs text-ink-2">
                      <span className="flex-1">{formatDate(x.date, "day")}</span>
                      {x.received ? <Badge tone="positive">přijato</Badge> : <><Badge tone={x.late ? "warning" : "neutral"}>{x.late ? "zpožděno" : "očekáváno"}</Badge><PayOccurrenceButton kind="income" refId={src.id} name={src.name} occurrenceDate={x.date} amount={src.amount} accountId={src.account_id} /><OccurrenceMenu kind="income" refId={src.id} date={x.date} marked={false} /></>}
                      {x.received && marks.has(x.key) && <OccurrenceMenu kind="income" refId={src.id} date={x.date} marked />}
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        ) : <p className="text-sm text-ink-3">Žádné pravidelné příjmy.</p>}
      </Card>
    </div>
  );
}
