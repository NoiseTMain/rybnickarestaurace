import { phrase } from "@/lib/i18n/phrase";
import { Download, RotateCcw, Trash2, XCircle } from "lucide-react";
import { requireContext } from "@/lib/context";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { loadData } from "@/lib/data";
import { addDays, endOfMonth, endOfWeek, formatDate, monthName, shortMonth, startOfMonth, startOfWeek, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { aggregate, groupBy, inPeriod, payoutView, shiftCosts, shiftGross, shiftNet } from "@/lib/finance/work";
import { deletePayout, deleteShift, setPayoutStatus } from "@/lib/actions/work";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { ActionButton } from "@/components/ui/ActionButton";
import { LinkButton } from "@/components/ui/Button";
import { FilterTabs, MonthPicker } from "@/components/lists/Filters";
import { PayoutButton, ReceivePayoutButton, ShiftButton, WorkSettingsForm } from "@/components/forms/WorkForms";
import { JOB_TYPES, type JobType } from "@/lib/work-types";
import { ShiftImportButton } from "@/components/forms/CsvImport";
import { WorkChart } from "@/components/charts/Charts";
import { KV } from "@/components/dashboard/bits";

export const metadata = { title: "Práce" };

const hours = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} h`;

export default async function WorkPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const data = await loadData(ctx);
  const ws = data.workSettings;
  if (!ws?.company) {
    return (
      <div className="space-y-4">
        <PageHeader title="Práce" subtitle="Evidence práce, výdělků a výplat – pro zaměstnání, brigády, směny, kurýry i OSVČ" />
        <Card title="Kde pracujete?" subtitle="Nastavte jednou, pak jen zapisujete směny nebo hodiny">
          <WorkSettingsForm />
        </Card>
      </div>
    );
  }
  const today = todayISO();
  const tab = sp.tab ?? "";
  const month = /^\d{4}-\d{2}$/.test(sp.mesic ?? "") ? sp.mesic! : today.slice(0, 7);
  const mFrom = `${month}-01`;
  const mTo = endOfMonth(mFrom);
  const all = aggregate("all", data.shifts);
  const thisMonth = aggregate("m", inPeriod(data.shifts, startOfMonth(today), today));
  const thisWeek = aggregate("w", inPeriod(data.shifts, startOfWeek(today), endOfWeek(today)));
  const todayAgg = aggregate("d", inPeriod(data.shifts, today, today));
  const view = (sp.graf ?? "mesic") as "den" | "tyden" | "mesic";
  const chartData = view === "den"
    ? groupBy(inPeriod(data.shifts, addDays(today, -29), today), "day").map((a) => ({ label: `${Number(a.key.slice(8))}.${Number(a.key.slice(5, 7))}.`, net: a.net, hours: a.minutes / 60 }))
    : view === "tyden"
      ? groupBy(inPeriod(data.shifts, addDays(startOfWeek(today), -7 * 11), today), "week").map((a) => ({ label: `${Number(a.key.slice(8))}.${Number(a.key.slice(5, 7))}.`, net: a.net, hours: a.minutes / 60 }))
      : groupBy(data.shifts, "month").slice(-12).map((a) => ({ label: phrase(shortMonth(`${a.key}-01`)), net: a.net, hours: a.minutes / 60 }));
  const monthShifts = inPeriod(data.shifts, mFrom, mTo);
  const monthAgg = aggregate("sel", monthShifts);
  const payouts = data.payouts.map((p) => payoutView(p, today));
  const issued = data.invoices.filter((i) => i.direction === "issued" && i.status !== "cancelled");

  return (
    <div className="space-y-4">
      <ReadOnlyNotice ctx={ctx} section="work" />
      <PageHeader title={`Práce – ${ws.company}`} subtitle={`${ws.position ? `${ws.position} · ` : ""}${JOB_TYPES[(ws.job_type ?? "courier") as JobType].label} · evidence směn, výdělků, nákladů a výplat`}
        actions={<><ShiftImportButton /><LinkButton href="/api/export/smeny" size="sm" icon={<Download className="h-4 w-4" />}>Export</LinkButton><ShiftButton label="Nová směna" variant="primary" size="md" /></>} />
      <FilterTabs name="tab" options={[{ value: "", label: "Přehled" }, { value: "smeny", label: "Směny", count: data.shifts.length }, { value: "vyplaty", label: "Výplaty", count: data.payouts.length }, { value: "nastaveni", label: "Nastavení" }]} />

      {tab === "" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[{ l: "Dnes", a: todayAgg }, { l: "Tento týden", a: thisWeek }, { l: monthName(today, false), a: thisMonth }, { l: "Celkem", a: all }].map(({ l, a }) => (
              <Card key={l} className="!p-4">
                <p className="text-[11px] uppercase tracking-wider text-ink-3">{l}</p>
                <Money value={a.net} decimals="never" className="text-xl font-semibold sm:text-2xl" />
                <p className="mt-0.5 text-xs text-ink-3">{a.days} dní · {hours(a.minutes)}</p>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card title="Vývoj čistého výsledku" action={<FilterTabs name="graf" options={[{ value: "den", label: "Dny" }, { value: "tyden", label: "Týdny" }, { value: "", label: "Měsíce" }]} />}>
              {chartData.length ? <WorkChart data={chartData} /> : <EmptyState title="Zatím žádné směny" />}
            </Card>
            <Card title={`Tento měsíc`} subtitle={`${thisMonth.shifts} směn`}>
              <KV k="Počet odpracovaných dní" v={thisMonth.days} />
              <KV k="Odpracovaný čas" v={hours(thisMonth.minutes)} />
              <KV k="Z toho špička / mimo špičku" v={`${hours(thisMonth.peakMinutes)} / ${hours(thisMonth.minutes - thisMonth.peakMinutes)}`} />
              <KV k="Běžné / expresní trasy" v={`${thisMonth.regularRoutes} / ${thisMonth.expressRoutes}`} />
              <KV k="Objednávky" v={thisMonth.orders} />
              <div className="my-2 border-t border-white/[0.06]" />
              <KV k="Základ" v={<Money value={thisMonth.base} />} />
              <KV k="Spropitné" v={<Money value={thisMonth.tips} />} />
              <KV k="Bonusy a odměny" v={<Money value={thisMonth.bonuses + thisMonth.rewards} />} />
              <KV k="Celkový příjem" v={<Money value={thisMonth.gross} />} strong />
              <KV k="Celkové náklady" v={<Money value={-thisMonth.costs} />} />
              <KV k="Čistý výsledek" v={<Money value={thisMonth.net} className="text-gold" />} strong />
              <KV k="Průměr za pracovní den" v={<Money value={thisMonth.avgPerDay} />} />
              <KV k="Průměr za hodinu" v={<Money value={thisMonth.avgPerHour} />} />
            </Card>
          </div>
          <Card title="Celková bilance" subtitle="Za celou evidenci">
            <div className="grid gap-x-8 sm:grid-cols-3">
              <KV k="Celkový příjem" v={<Money value={all.gross} />} />
              <KV k="Celkové náklady" v={<Money value={all.costs} />} />
              <KV k="Čistý výsledek" v={<Money value={all.net} />} strong />
              <KV k="Průměr / den" v={<Money value={all.avgPerDay} />} />
              <KV k="Průměr / hodinu" v={<Money value={all.avgPerHour} />} />
              <KV k="Přijaté výplaty" v={<Money value={payouts.filter((p) => p.status === "received").reduce((a, p) => a + (p.received_amount ?? 0), 0)} />} />
            </div>
          </Card>
        </>
      )}

      {tab === "smeny" && (
        <Card title={`Směny · ${monthName(mFrom)}`} subtitle={`${monthAgg.days} dní · ${hours(monthAgg.minutes)} · čistě ${formatMoney(monthAgg.net)}`} action={<MonthPicker value={month} />}>
          {monthShifts.length ? (
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-ink-3">
                  <tr><th className="px-4 py-2 font-medium sm:px-5">Datum</th><th className="font-medium">Čas</th><th className="font-medium">Trasy b/e</th><th className="font-medium">Obj.</th><th className="text-right font-medium">Příjem</th><th className="text-right font-medium">Náklady</th><th className="text-right font-medium">Čistě</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {monthShifts.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2 sm:px-5">{formatDate(s.date, "day")}{s.note && <span className="block text-[11px] text-ink-3">{s.note}</span>}</td>
                      <td className="text-ink-2">{hours(s.minutes)}{s.peak_minutes > 0 && <span className="text-[11px] text-ink-3"> (špička {hours(s.peak_minutes)})</span>}</td>
                      <td className="text-ink-2">{s.regular_routes} / {s.express_routes}</td>
                      <td className="text-ink-2">{s.orders}</td>
                      <td className="text-right"><Money value={shiftGross(s)} /></td>
                      <td className="text-right text-ink-2"><Money value={-shiftCosts(s)} /></td>
                      <td className="text-right font-medium"><Money value={shiftNet(s)} /></td>
                      <td className="whitespace-nowrap px-2 text-right"><ShiftButton initial={s} size="icon" variant="ghost" /><ActionButton action={deleteShift.bind(null, s.id)} confirm="Smazat směnu?" size="icon" icon={<Trash2 className="h-4 w-4" />} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="V tomto měsíci žádné směny" action={<ShiftButton label="Přidat směnu" variant="primary" />}>Směny můžete zadávat ručně nebo importovat z CSV.</EmptyState>}
        </Card>
      )}

      {tab === "vyplaty" && (
        <Card title="Výplaty" subtitle="Očekávání vs. skutečnost. Očekávaná výplata se do dostupných peněz nepočítá." action={<div className="flex gap-2"><LinkButton href="/api/export/vyplaty" size="sm" icon={<Download className="h-4 w-4" />}>Export</LinkButton><PayoutButton label="Očekávaná výplata" invoices={issued} variant="primary" /></div>}>
          {payouts.length ? (
            <ul className="divide-y divide-white/[0.05]">
              {payouts.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{p.label}</p>
                    <p className="text-[11px] text-ink-3">
                      {p.period_from && `${formatDate(p.period_from)} – ${formatDate(p.period_to)} · `}očekáváno {formatDate(p.expected_date)}
                      {p.received_date && ` · přijato ${formatDate(p.received_date)}`}
                    </p>
                  </div>
                  {p.status === "received" ? <Badge tone="positive">přijato</Badge> : p.status === "cancelled" ? <Badge>zrušeno</Badge> : p.isLate ? <Badge tone="warning">zpožděno</Badge> : <Badge tone="gold">očekáváno</Badge>}
                  <div className="text-right text-sm">
                    <div><span className="text-ink-3">čekáno </span><Money value={p.expected_amount} /></div>
                    {p.received_amount != null && <div><span className="text-ink-3">přišlo </span><Money value={p.received_amount} />{p.difference !== 0 && p.difference != null && <Money value={p.difference} sign colored className="ml-1 text-xs" />}</div>}
                  </div>
                  <div className="flex items-center">
                    {p.status === "expected" && <ReceivePayoutButton payout={p} />}
                    {p.status !== "received" && <PayoutButton initial={p} invoices={issued} size="icon" variant="ghost" />}
                    {p.status === "expected" && <ActionButton action={setPayoutStatus.bind(null, p.id, "cancelled")} confirm="Zrušit očekávanou výplatu?" size="icon" icon={<XCircle className="h-4 w-4" />} />}
                    {p.status !== "expected" && <ActionButton action={setPayoutStatus.bind(null, p.id, "expected")} confirm={p.status === "received" ? "Vrátit mezi očekávané? Související příjem bude stornován." : "Obnovit výplatu?"} size="icon" icon={<RotateCcw className="h-4 w-4" />} />}
                    <ActionButton action={deletePayout.bind(null, p.id)} confirm="Smazat výplatu? Případný příjem zůstane v transakcích." size="icon" icon={<Trash2 className="h-4 w-4" />} />
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Zatím žádné výplaty" />}
        </Card>
      )}

      {tab === "nastaveni" && <Card title="Pracovní nastavení"><WorkSettingsForm /></Card>}
    </div>
  );
}
