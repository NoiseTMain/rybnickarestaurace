import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BedDouble, CalendarDays, ExternalLink, FileText, MapPin, Paperclip, PiggyBank, StickyNote, Ticket, Users } from "lucide-react";
import { canEdit, requireContext } from "@/lib/context";
import { getPremium } from "@/lib/premium";
import { PremiumWall } from "@/components/premium/PremiumWall";
import { loadSnapshot } from "@/lib/data";
import { carrierSite, categoryBudgetStatus, connectionLinks, effectiveExpenses, KIND_LABEL, MODE_LABEL, settle, STATUS_LABEL, suggestTripTransactions, summarizeTrip, wallets } from "@/lib/finance/travel";
import { addDays, diffDays, formatDate } from "@/lib/dates";
import { divFloor, formatMoney, sum } from "@/lib/money";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { FilterTabs } from "@/components/lists/Filters";
import { CategoryDonut, TripDaysChart } from "@/components/charts/Charts";
import { DeleteExpenseButton, DeleteTripButton, ExpenseButton, LegActions, LegButton, LinkTxRow, TripButton } from "@/components/travel/TripForms";
import { CashButton, Checklist, DeleteCashButton, DeletePlanButton, DetachDocButton, DuplicateTripButton, GoalButton, LinkSuggestedButton, PeopleEditor, PlanButton, SettleActions, ShareTrip, TripDocUpload, UndoSettlementButton } from "@/components/travel/TripExtras";
import { normalizeIban } from "@/lib/qr-payment";
import { MODE_ICON } from "@/components/travel/icons";
import { TripMap, type MapLine, type MapPoint } from "@/components/travel/TripMap";

export const metadata = { title: "Cesta" };

const Stat = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) => (
  <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">{label}</p>{children}{hint && <p className="mt-0.5 text-[11px] text-ink-3">{hint}</p>}</Card>
);

const fmtOrig = (v: number, cur: string) => `${(v / 100).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} ${cur}`;
const kc = (c: number) => formatMoney(c, { decimals: "never" });

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireContext();
  if (!(await getPremium(ctx)).household) return <PremiumWall title="Cestování je součástí Premium" highlight="travel">Plánujte cesty, trasy a dopravu, hlídejte rozpočet na místě, hotovost v cizí měně a kdo komu dluží. Uložené cesty se neztratí – po aktivaci je zase uvidíte.</PremiumWall>;
  const { data, snapshot, today } = await loadSnapshot(ctx);
  const tr = data.travel;
  const trip = tr.trips.find((t) => t.id === id);
  if (!trip) notFound();
  const tab = sp.tab ?? "";
  const edit = canEdit(ctx, "travel");
  const legs = tr.legs.filter((l) => l.trip_id === id);
  const people = tr.people.filter((p) => p.trip_id === id);
  const cash = tr.cash.filter((c) => c.trip_id === id);
  const checklist = tr.checklist.filter((c) => c.trip_id === id);
  const plan = tr.plan.filter((p) => p.trip_id === id);
  const expenses = effectiveExpenses(tr.expenses.filter((e) => e.trip_id === id), data.transactions);
  const s = summarizeTrip(trip, legs, expenses, today, cash);
  const ws = wallets(cash, expenses);
  const extras = { people, wallets: ws };
  const paidLeg = new Map(expenses.filter((e) => e.leg_id).map((e) => [e.leg_id!, e]));
  const planned = expenses.filter((e) => e.status === "planned");
  const paid = expenses.filter((e) => e.status === "paid");
  const personName = (pid: string | null) => people.find((p) => p.id === pid)?.name ?? null;
  const goal = trip.goal_id ? snapshot.goals.progress.find((g) => g.goal.id === trip.goal_id) : null;

  // denní limit na útratu na místě = rozpočet bez dopravy a ubytování / počet dní
  const fixedCosts = sum(expenses.filter((e) => e.kind === "transport" || e.kind === "accommodation"), (e) => e.value) + s.unpaidLegs;
  const dailyLimit = trip.budget != null && s.days ? divFloor(Math.max(0, trip.budget - fixedCosts), s.days) : null;
  const tripEnd = trip.end_date ?? trip.start_date;
  const onSite = new Map<string, number>();
  if (trip.start_date && tripEnd) {
    for (let d = trip.start_date; d <= tripEnd && d <= (s.status === "finished" ? tripEnd : today); d = addDays(d, 1)) onSite.set(d, 0);
    for (const e of paid) if (e.date && onSite.has(e.date) && e.kind !== "transport" && e.kind !== "accommodation") onSite.set(e.date, onSite.get(e.date)! + e.value);
  }
  const dayLabel = (d: string) => (trip.start_date && d >= trip.start_date && (!trip.end_date || d <= trip.end_date) ? `${diffDays(trip.start_date, d) + 1}. den` : formatDate(d));

  // platby z účtu v termínu cesty, které ještě nejsou přiřazené (výměny hotovosti se nepočítají)
  const linked = new Set([...tr.expenses.map((e) => e.transaction_id), ...tr.cash.map((c) => c.transaction_id)].filter((x): x is string => Boolean(x)));
  const candidates = suggestTripTransactions(trip, data.transactions, linked);
  const suggestedCount = candidates.filter((c) => c.suggested).length;

  const docs = data.documents.filter((d) => d.trip_id === id || legs.some((l) => l.document_id === d.id) || expenses.some((e) => e.document_id === d.id));
  const doneSettlements = tr.settlements.filter((x) => x.trip_id === id);
  const settlement = people.length >= 2 ? settle(people, expenses, doneSettlements) : null;
  const kindBudgets = categoryBudgetStatus(trip, legs, expenses);

  const points: MapPoint[] = trip.lat != null ? [{ lat: trip.lat, lon: trip.lon!, label: trip.destination, main: true }] : [];
  const lines: MapLine[] = legs.filter((l) => l.from_lat != null && l.to_lat != null).map((l) => ({ from: [l.from_lat!, l.from_lon!], to: [l.to_lat!, l.to_lon!], mode: l.mode, polyline: l.route_polyline, label: `${MODE_LABEL[l.mode]}${l.carrier ? ` · ${l.carrier}` : ""}: ${l.from_place} → ${l.to_place}` }));
  const banner = s.status === "upcoming" ? (s.daysUntil === 0 ? "Odjezd je dnes – šťastnou cestu!" : `Odjezd za ${s.daysUntil} ${s.daysUntil === 1 ? "den" : s.daysUntil! < 5 ? "dny" : "dní"}`)
    : s.status === "ongoing" ? `Právě jste na cestě – ${diffDays(trip.start_date!, today) + 1}. den z ${s.days}`
    : s.status === "finished" ? "Cesta skončila – kompletní přehled je v záložce Souhrn."
    : "Zatím jen nápad – doplňte termín a rozpočet.";

  // program po dnech: úseky trasy + položky programu
  type DayEntry = { key: string; time: string | null; node: React.ReactNode };
  const byDay = new Map<string, DayEntry[]>();
  const noDate: DayEntry[] = [];
  const push = (d: string | null, e: DayEntry) => (d ? byDay.set(d, [...(byDay.get(d) ?? []), e]) : noDate.push(e));
  for (const l of legs) {
    const I = MODE_ICON[l.mode];
    push(l.depart_date, { key: l.id, time: l.depart_time, node: <span className="flex items-center gap-2"><I className="h-4 w-4 text-gold" />{MODE_LABEL[l.mode]}{l.carrier ? ` ${l.carrier}` : ""}: {l.from_place} → {l.to_place}</span> });
  }
  for (const p of plan) {
    const icon = p.kind === "stay" ? <BedDouble className="h-4 w-4 text-gold" /> : p.kind === "activity" ? <CalendarDays className="h-4 w-4 text-gold" /> : <StickyNote className="h-4 w-4 text-gold" />;
    push(p.date, {
      key: p.id, time: p.time, node: (
        <span className="flex min-w-0 flex-1 items-start gap-2">
          {icon}
          <span className="min-w-0 flex-1">
            <span className="block">{p.title}{p.kind === "stay" && p.end_date ? <span className="text-ink-3"> · do {formatDate(p.end_date)}</span> : null}</span>
            {p.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`} target="_blank" rel="noreferrer" className="block text-xs text-gold hover:underline">{p.address}</a>}
            {p.note && <span className="block text-xs text-ink-3">{p.note}</span>}
            {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline">Odkaz</a>}
          </span>
          {edit && <span className="flex shrink-0"><PlanButton trip={trip} initial={p} /><DeletePlanButton id={p.id} /></span>}
        </span>
      ),
    });
  }
  const days = [...byDay.keys()].sort();

  const tabs = [
    { value: "", label: "Přehled" },
    { value: "trasa", label: "Trasa a program", count: legs.length + plan.length },
    { value: "vydaje", label: "Výdaje", count: expenses.length },
    { value: "priprava", label: "Příprava", count: checklist.filter((c) => !c.done).length },
    { value: "souhrn", label: "Souhrn" },
  ];

  return (
    <div className="space-y-4">
      <ReadOnlyNotice ctx={ctx} section="travel" />
      <Link href="/cestovani" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-gold"><ArrowLeft className="h-4 w-4" />Cestování</Link>
      <PageHeader
        title={trip.name}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{trip.destination}{trip.country ? `, ${trip.country}` : ""}</span><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{trip.start_date ? `${formatDate(trip.start_date)}${trip.end_date ? ` – ${formatDate(trip.end_date)}` : ""}` : "bez termínu"}</span><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{trip.travelers} {trip.travelers === 1 ? "osoba" : trip.travelers < 5 ? "osoby" : "osob"}</span></span>}
        actions={edit ? <div className="flex flex-wrap gap-2"><TripButton initial={trip} label="Upravit" variant="secondary" /><DuplicateTripButton trip={trip} /><DeleteTripButton id={trip.id} /></div> : null}
      />
      <div className={`rounded-2xl border px-4 py-2.5 text-sm ${s.status === "ongoing" ? "border-pos/30 bg-pos/10 text-pos" : s.status === "finished" ? "border-white/10 bg-white/[0.04] text-ink-2" : "border-gold/30 bg-gold/10 text-gold-bright"}`}>
        <Badge tone={s.status === "ongoing" ? "positive" : s.status === "finished" ? "neutral" : "gold"} className="mr-2">{STATUS_LABEL[s.status]}</Badge>{banner}
      </div>
      <FilterTabs name="tab" options={tabs} />

      {tab === "" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Rozpočet" hint={s.budget != null && s.days ? `${kc(divFloor(s.budget, s.days))} na den` : "nenastaven"}>{s.budget != null ? <Money value={s.budget} decimals="never" className="text-xl font-semibold" /> : <p className="text-xl text-ink-3">—</p>}</Stat>
            <Stat label="Zaplaceno" hint={`${kc(s.perPerson)} na osobu`}><Money value={s.paid} decimals="never" className="text-xl font-semibold" /></Stat>
            <Stat label="Ještě zaplatit" hint={s.unpaidLegs ? `z toho doprava ${kc(s.unpaidLegs)}` : "naplánované výdaje"}><Money value={s.plannedExpenses + s.unpaidLegs} decimals="never" className="text-xl font-semibold" /></Stat>
            <Stat label={s.status === "finished" ? "Zbylo z rozpočtu" : "Na útratu na místě"} hint={s.perDayAllowance != null && s.status !== "finished" ? <>≈ <b className="text-ink">{kc(s.perDayAllowance)}</b> na den{s.status === "ongoing" ? " (zbývající dny)" : ""}</> : s.budget == null ? "zadejte rozpočet" : undefined}>
              {s.spendingMoney != null ? <Money value={s.spendingMoney} decimals="never" colored={s.spendingMoney < 0} className="gold-text text-xl font-semibold" /> : <p className="text-xl text-ink-3">—</p>}
            </Stat>
          </div>
          {s.budget != null && s.budget > 0 && (
            <Progress value={Math.min(100, (s.total / s.budget) * 100)} marker={Math.min(100, (s.paid / s.budget) * 100)} tone={s.overBudget ? "neg" : "gold"} label={s.overBudget ? `Plán překračuje rozpočet o ${kc(s.total - s.budget)}` : `Rozpočet využit z ${Math.round((s.total / s.budget) * 100)} % (zaplaceno + naplánováno)`} />
          )}

          {(s.status === "upcoming" || s.status === "ongoing") && s.toCover > 0 && (
            <Card className="!p-4">
              <div className="flex gap-3">
                <PiggyBank className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p>{s.status === "ongoing" ? "Do konce cesty počítáte ještě s" : "Cesta bude stát ještě"} <b>{kc(s.toCover)}</b>{s.budget != null ? " (do výše rozpočtu)" : ""}. Plánovač s tím počítá:</p>
                  <ul className="space-y-0.5 text-ink-2">
                    {s.dueThisMonth > 0 && <li>• <b className="text-ink">{kc(s.dueThisMonth)}</b> splatné do konce měsíce je v nadcházejících platbách</li>}
                    {s.cashLeft > 0 && <li>• <b className="text-ink">{kc(s.cashLeft)}</b> už máte v hotovosti v cizí měně</li>}
                    {s.goalLinked && goal && <li>• zbytek drží cíl ve Spoření <Link href="/sporeni" className="text-gold underline">{goal.goal.name}</Link>: naspořeno <b className="text-ink">{kc(goal.saved)}</b> z {kc(goal.goal.target_amount)}{goal.requiredMonthly ? `, odkládat ${kc(goal.requiredMonthly)} měsíčně` : ""}</li>}
                    {s.reserveNow > 0 && <li>• <b className="text-ink">{kc(s.reserveNow)}</b> je teď drženo stranou jako rezerva na cestu</li>}
                    {s.monthlyAdd != null && s.monthlyAdd > 0 && s.monthsLeft != null && <li>• rezerva se bude navyšovat o <b className="gold-text">{kc(s.monthlyAdd)} měsíčně</b> ({s.monthsLeft} {s.monthsLeft === 1 ? "měsíc" : s.monthsLeft < 5 ? "měsíce" : "měsíců"} do odjezdu)</li>}
                  </ul>
                  <p className="text-xs text-ink-3">Vše je už odečtené od „Volné k utracení“ ({kc(snapshot.planner.safeToSpend)}). Očekávané příjmy se nemění.</p>
                  {snapshot.planner.needToEarn > 0 && <p className="text-warn">Na všechny plány tohoto měsíce teď chybí {kc(snapshot.planner.needToEarn)}.</p>}
                </div>
                {edit && s.status === "upcoming" && <div className="shrink-0"><GoalButton tripId={trip.id} linked={s.goalLinked} /></div>}
              </div>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Kdo jede a kdo komu dluží" subtitle={settlement ? (settlement.transfers.length ? "Vyrovnání s co nejméně převody" : "Vše je vyrovnané") : "Přidejte aspoň 2 účastníky"}>
              <PeopleEditor tripId={trip.id} people={people} edit={edit} />
              {settlement && (
                <div className="mt-4 space-y-3">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-ink-3"><tr><th className="text-left font-medium">Kdo</th><th className="text-right font-medium">Zaplatil</th><th className="text-right font-medium">Jeho podíl</th><th className="text-right font-medium">Rozdíl</th></tr></thead>
                    <tbody>{settlement.balances.map((b) => <tr key={b.personId} className="border-t border-white/[0.06]"><td className="py-1.5">{b.name}</td><td className="num text-right">{kc(b.paid)}</td><td className="num text-right">{kc(b.share)}</td><td className={`num text-right ${b.balance > 0 ? "text-pos" : b.balance < 0 ? "text-neg" : ""}`}>{formatMoney(b.balance, { decimals: "never", sign: true })}</td></tr>)}</tbody>
                  </table>
                  {settlement.transfers.map((t) => {
                    const acc = people.find((p) => p.id === t.to)?.account;
                    return (
                      <div key={`${t.from}-${t.to}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-gold/10 px-3 py-2 text-sm">
                        <b>{t.fromName}</b><ArrowRight className="h-4 w-4 text-gold" /><b>{t.toName}</b><span className="num ml-auto font-semibold">{formatMoney(t.amount)}</span>
                        <SettleActions tripId={trip.id} from={t.from} to={t.to} amount={t.amount} iban={acc ? normalizeIban(acc) : null} message={`${trip.name} vyrovnani`} edit={edit} />
                      </div>
                    );
                  })}
                  {doneSettlements.length > 0 && (
                    <div className="text-xs text-ink-3">
                      <p className="mb-1 uppercase tracking-wider">Už vyrovnáno</p>
                      {doneSettlements.map((d) => <p key={d.id} className="flex items-center gap-2"><span className="flex-1">{personName(d.from_person)} → {personName(d.to_person)} · {formatDate(d.date)}</span><span className="num">{formatMoney(d.amount)}</span>{edit && <UndoSettlementButton id={d.id} />}</p>)}
                    </div>
                  )}
                  {people.length > 0 && !people.some((p) => p.account) && settlement.transfers.length > 0 && <p className="text-xs text-ink-3">Tip: klikněte na jméno účastníka a doplňte číslo účtu – u převodu se pak ukáže QR kód pro platbu.</p>}
                  {settlement.unassigned > 0 && <p className="text-xs text-ink-3">{kc(settlement.unassigned)} je bez uvedeného plátce – do vyrovnání se nepočítá.</p>}
                </div>
              )}
            </Card>
            <Card title="Hotovost v cizí měně" subtitle="Výměna nebo bankomat se odečte z účtu jednou, platby v hotovosti už ne" action={edit ? <div className="flex gap-1"><CashButton trip={trip} kind="buy" label="Výměna / bankomat" />{ws.some((w) => w.left > 0) && <CashButton trip={trip} kind="return" label="Vrátit zbytek" variant="ghost" />}</div> : null}>
              {ws.length ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ws.map((w) => (
                      <div key={w.currency} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                        <p className="text-xs text-ink-3">V peněžence</p>
                        <p className="text-xl font-semibold">{fmtOrig(w.left, w.currency)}</p>
                        <p className="text-xs text-ink-3">≈ {kc(w.leftCzk)} · koupeno {fmtOrig(w.bought, w.currency)} za {kc(w.boughtCzk)}{w.avgRate ? ` (kurz ${w.avgRate.toLocaleString("cs-CZ", { maximumFractionDigits: 3 })})` : ""} · utraceno {fmtOrig(w.spent, w.currency)}</p>
                      </div>
                    ))}
                  </div>
                  <ul className="mt-2">
                    {cash.map((c) => <li key={c.id} className="flex items-center gap-2 border-t border-white/[0.06] py-1.5 text-xs"><span className="w-20 text-ink-3">{formatDate(c.date)}</span><span className="flex-1">{c.kind === "buy" ? "Výměna / výběr" : "Vrácení zbytku"} {fmtOrig(c.amount_original, c.currency)}{c.note ? ` · ${c.note}` : ""}</span><span className="num">{kc(c.amount)}</span>{edit && <DeleteCashButton id={c.id} linked={Boolean(c.transaction_id)} />}</li>)}
                  </ul>
                </>
              ) : <p className="text-sm text-ink-3">Vyměnili jste peníze nebo vybrali z bankomatu? Zapište to sem – hotovostní platby pak půjdou z peněženky a nezapočítají se dvakrát.</p>}
            </Card>
          </div>
          {kindBudgets.length > 0 && (
            <Card title="Rozpočet po kategoriích" subtitle="Zaplaceno + naplánováno proti limitu">
              <div className="grid gap-3 sm:grid-cols-2">
                {kindBudgets.map((k) => (
                  <div key={k.kind} className="text-sm">
                    <div className="flex justify-between"><span>{k.label}</span><span className={k.over ? "text-neg" : "text-ink-2"}>{kc(k.spent + k.planned)} / {kc(k.budget)}</span></div>
                    <Progress className="mt-1" value={Math.min(100, ((k.spent + k.planned) / k.budget) * 100)} marker={Math.min(100, (k.spent / k.budget) * 100)} tone={k.over ? "neg" : "gold"} label={k.label} />
                    <p className={`mt-0.5 text-xs ${k.over ? "text-neg" : "text-ink-3"}`}>{k.over ? `přes limit o ${kc(-k.left)}` : `zbývá ${kc(k.left)}`}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {edit && <Card title="Sdílet cestu" subtitle="Odkaz jen pro čtení pro spolucestující"><ShareTrip tripId={trip.id} token={trip.share_token ?? null} /></Card>}
          {paid.length > 0 && <p className="text-sm text-ink-2">Utraceno zatím {kc(s.paid)}{s.perDayActual != null ? ` · ${kc(s.perDayActual)} na den` : ""}. <Link href="?tab=souhrn" className="text-gold underline">Grafy a souhrn</Link></p>}
        </>
      )}

      {tab === "trasa" && (
        <>
          <Card title="Trasa" subtitle={legs.length ? `${legs.length} ${legs.length === 1 ? "úsek" : legs.length < 5 ? "úseky" : "úseků"}${s.distanceKm ? ` · přibližně ${s.distanceKm.toLocaleString("cs-CZ")} km` : ""}${s.carriers.length ? ` · ${s.carriers.join(", ")}` : ""}` : "Vlak, autobus, auto, letadlo…"} action={edit ? <LegButton tripId={trip.id} last={legs.at(-1) ?? null} label="Přidat úsek" size="sm" /> : null}>
            {(points.length > 0 || lines.length > 0) && <div className="mb-4"><TripMap points={points} lines={lines} /></div>}
            {legs.length ? (
              <ol className="space-y-2">
                {legs.map((l, i) => {
                  const I = MODE_ICON[l.mode];
                  const pe = paidLeg.get(l.id);
                  const site = carrierSite(l.carrier);
                  return (
                    <li key={l.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold"><I className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-1 font-medium">{l.from_place}<ArrowRight className="h-3.5 w-3.5 text-ink-3" />{l.to_place}</p>
                          <p className="text-xs text-ink-2">
                            {MODE_LABEL[l.mode]}{l.carrier && <> · {site ? <a href={site} target="_blank" rel="noreferrer" className="text-gold underline">{l.carrier}</a> : l.carrier}</>}
                            {l.depart_date && <> · {formatDate(l.depart_date)}{l.depart_time ? ` ${l.depart_time}` : ""}</>}
                            {(l.arrive_date || l.arrive_time) && <> → {l.arrive_date && l.arrive_date !== l.depart_date ? `${formatDate(l.arrive_date)} ` : ""}{l.arrive_time ?? ""}</>}
                            {l.distance_km ? ` · ${l.distance_km} km` : ""}
                          </p>
                          {(l.booking_ref || l.note) && <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">{l.booking_ref && <><Ticket className="h-3 w-3" />{l.booking_ref}</>}{l.note && <span>{l.booking_ref ? " · " : ""}{l.note}</span>}</p>}
                          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                            {connectionLinks(l).map((c) => <a key={c.label} href={c.href} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-gold hover:underline">{c.label}<ExternalLink className="h-3 w-3" /></a>)}
                            {l.url && <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-gold hover:underline">Jízdenka<ExternalLink className="h-3 w-3" /></a>}
                            {l.document_id && <a href={`/api/files/${l.document_id}`} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-gold hover:underline"><Paperclip className="h-3 w-3" />Jízdenka (soubor)</a>}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {l.price != null && <Money value={pe ? pe.value : l.price} decimals="never" className="font-semibold" />}
                          {pe ? <Badge tone="positive">zaplaceno</Badge> : l.price != null ? <Badge tone="warning">nezaplaceno</Badge> : null}
                        </div>
                      </div>
                      {edit && (
                        <div className="mt-2 flex items-center justify-end gap-1 border-t border-white/[0.06] pt-2">
                          {!pe && <ExpenseButton trip={trip} leg={l} label="Zaplaceno" size="sm" variant="ghost" {...extras} />}
                          <LegActions leg={l} first={i === 0} lastOne={i === legs.length - 1} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState title="Zatím bez trasy">Přidejte úseky cesty – čím pojedete (vlak, bus, auto, letadlo…), s jakým dopravcem (RegioJet, ČD, FlixBus…), kdy a za kolik. Trasu uvidíte na mapě a najdete spoje na IDOS.</EmptyState>
            )}
          </Card>
          <Card title="Program po dnech" subtitle="Doprava, ubytování, výlety a poznámky" action={edit ? <PlanButton trip={trip} label="Přidat" /> : null}>
            {days.length || noDate.length ? (
              <div className="space-y-4">
                {days.map((d) => (
                  <div key={d}>
                    <p className="mb-1 text-xs uppercase tracking-wider text-ink-3">{dayLabel(d)} · {formatDate(d, "long")}</p>
                    <ul className="space-y-1.5">{byDay.get(d)!.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99")).map((e) => <li key={e.key} className="flex items-start gap-3 text-sm"><span className="num w-12 shrink-0 pt-0.5 text-xs text-ink-3">{e.time ?? ""}</span>{e.node}</li>)}</ul>
                  </div>
                ))}
                {noDate.length > 0 && <div><p className="mb-1 text-xs uppercase tracking-wider text-ink-3">Bez data</p><ul className="space-y-1.5">{noDate.map((e) => <li key={e.key} className="flex items-start gap-3 text-sm"><span className="w-12 shrink-0" />{e.node}</li>)}</ul></div>}
              </div>
            ) : <p className="text-sm text-ink-3">Přidejte ubytování (adresa, check-in), výlety a poznámky – vše se seřadí po dnech spolu s dopravou.</p>}
          </Card>
        </>
      )}

      {tab === "vydaje" && (
        <Card title="Výdaje na cestě" subtitle="Ubytování, jídlo, výlety… i v cizí měně s kurzem ČNB" action={edit ? <div className="flex gap-1"><ExpenseButton trip={trip} planned label="Naplánovat" size="sm" variant="ghost" {...extras} /><ExpenseButton trip={trip} label="Výdaj" size="sm" variant="primary" {...extras} /></div> : null}>
          {planned.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs uppercase tracking-wider text-ink-3">Naplánováno</p>
              <ul>
                {planned.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 border-t border-white/[0.06] py-2 text-sm">
                    <span className="min-w-0 flex-1"><span className="block truncate">{e.description}</span><span className="text-xs text-ink-3">{KIND_LABEL[e.kind]}{e.place ? ` · ${e.place}` : ""}{e.date ? ` · do ${formatDate(e.date)}` : ""}</span></span>
                    <span className="text-right"><Money value={e.value} decimals="never" />{e.currency !== "CZK" && e.amount_original != null && <span className="block text-[11px] text-ink-3">{fmtOrig(e.amount_original, e.currency)}</span>}</span>
                    {edit && <><ExpenseButton trip={trip} initial={e} icon="pay" label="Zaplatit" size="sm" variant="secondary" {...extras} /><ExpenseButton trip={trip} initial={e} icon="edit" size="icon" variant="ghost" {...extras} /><DeleteExpenseButton e={e} /></>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {paid.length ? (
            <ul>
              {paid.map((e) => (
                <li key={e.id} className="flex items-center gap-2 border-t border-white/[0.06] py-2 text-sm">
                  <span className="w-14 shrink-0 text-xs text-ink-3">{e.date ? dayLabel(e.date) : ""}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate">{e.description}{e.document_id && <a href={`/api/files/${e.document_id}`} target="_blank" rel="noreferrer" className="ml-1 inline-block text-gold" aria-label="Účtenka"><Paperclip className="inline h-3 w-3" /></a>}</span><span className="text-xs text-ink-3">{KIND_LABEL[e.kind]}{e.place ? ` · ${e.place}` : ""}{e.from_cash ? " · z hotovosti" : e.transaction_id ? " · v příjmech a výdajích" : ""}{personName(e.paid_by) ? ` · platil(a) ${personName(e.paid_by)}` : ""}{e.split_among?.length ? ` · za ${e.split_among.map(personName).filter(Boolean).join(", ")}` : ""}</span></span>
                  <span className="text-right"><Money value={e.value} />{e.currency !== "CZK" && e.amount_original != null && <span className="block text-[11px] text-ink-3">{fmtOrig(e.amount_original, e.currency)}{e.rate ? ` · kurz ${Number(e.rate).toLocaleString("cs-CZ", { maximumFractionDigits: 3 })}` : ""}</span>}</span>
                  {edit && <><ExpenseButton trip={trip} initial={e} icon="edit" size="icon" variant="ghost" {...extras} /><DeleteExpenseButton e={e} /></>}
                </li>
              ))}
            </ul>
          ) : !planned.length ? (
            <p className="py-4 text-center text-sm text-ink-3">Zatím žádné výdaje. Na cestě zapisujte útraty – i v eurech, kurz se doplní sám. Rychle to jde přes tlačítko +.</p>
          ) : null}
          {edit && candidates.length > 0 && (
            <details className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3" open={suggestedCount > 0}>
              <summary className="cursor-pointer text-sm text-ink-2">Platby z účtu v termínu cesty ({candidates.length}){suggestedCount ? ` – navrženo ${suggestedCount}` : ""}</summary>
              {suggestedCount > 0 && <div className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-3"><span>Navržené podle místa, měny, obchodníka a termínu – druh výdaje se odhadne.</span><LinkSuggestedButton tripId={trip.id} count={suggestedCount} /></div>}
              <ul className="mt-2">{candidates.slice(0, 50).map(({ tx: t, reason }) => <LinkTxRow key={t.id} tripId={trip.id} tx={{ id: t.id, date: t.date, description: t.description, amount: t.amount, category: data.categories.find((c) => c.id === t.category_id)?.name ?? null, reason }} />)}</ul>
            </details>
          )}
        </Card>
      )}

      {tab === "priprava" && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card title="Co vyřídit a sbalit" subtitle="Doklady, pojištění, auto, letadlo, moře, doma…">
            <Checklist tripId={trip.id} items={checklist} edit={edit} />
          </Card>
          <Card title="Dokumenty" subtitle="Rezervace, jízdenky, pojištění – po ruce i v mobilu">
            {docs.length ? (
              <ul className="mb-3">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 border-t border-white/[0.06] py-2 text-sm first:border-0">
                    <FileText className="h-4 w-4 shrink-0 text-gold" />
                    <a href={`/api/files/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-gold">{d.title}</a>
                    <span className="text-xs text-ink-3">{legs.some((l) => l.document_id === d.id) ? "jízdenka" : expenses.some((e) => e.document_id === d.id) ? "účtenka" : ""}</span>
                    {edit && d.trip_id === trip.id && <DetachDocButton id={d.id} />}
                  </li>
                ))}
              </ul>
            ) : <p className="mb-3 text-sm text-ink-3">Zatím žádné dokumenty.</p>}
            {edit && <TripDocUpload tripId={trip.id} />}
          </Card>
        </div>
      )}

      {tab === "souhrn" && (paid.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Utraceno celkem"><Money value={s.paid} decimals="never" className="gold-text text-xl font-semibold" /></Stat>
            <Stat label="Průměr na den">{s.perDayActual != null ? <Money value={s.perDayActual} decimals="never" className="text-xl font-semibold" /> : <p className="text-xl text-ink-3">—</p>}</Stat>
            <Stat label="Na osobu"><Money value={s.perPerson} decimals="never" className="text-xl font-semibold" /></Stat>
            <Stat label="Oproti rozpočtu">{s.budget != null ? <Money value={s.budget - s.paid} sign decimals="never" colored className="text-xl font-semibold" /> : <p className="text-xl text-ink-3">—</p>}</Stat>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Za co"><CategoryDonut data={s.byKind.map((k) => ({ name: k.label, amount: k.amount }))} /></Card>
            <Card title="Po dnech" subtitle={`Útrata na místě (bez dopravy a ubytování)${dailyLimit != null ? ` · denní limit ${kc(dailyLimit)}` : ""}`}>
              {onSite.size ? <TripDaysChart data={[...onSite.entries()].map(([d, amount]) => ({ label: dayLabel(d), amount }))} limit={dailyLimit} /> : <p className="py-6 text-center text-sm text-ink-3">Graf se ukáže, až cesta začne.</p>}
            </Card>
            <Card title="Kde">
              <ul className="space-y-2">
                {s.byPlace.slice(0, 10).map((p) => (
                  <li key={p.place} className="text-sm">
                    <div className="mb-0.5 flex justify-between"><span className="truncate">{p.place} <span className="text-xs text-ink-3">({p.count}×)</span></span><Money value={p.amount} decimals="never" /></div>
                    <Progress value={(p.amount / s.byPlace[0].amount) * 100} />
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Největší výdaje">
              <ul>{s.top.map((e) => <li key={e.id} className="flex justify-between gap-2 border-t border-white/[0.06] py-1.5 text-sm first:border-0"><span className="min-w-0 truncate">{e.description}<span className="text-xs text-ink-3"> · {KIND_LABEL[e.kind]}{e.place ? ` · ${e.place}` : ""}</span></span><Money value={e.value} decimals="never" /></li>)}</ul>
              {s.byCurrency.length > 1 || s.byCurrency[0]?.currency !== "CZK" ? (
                <div className="mt-3 border-t border-white/[0.06] pt-2 text-xs text-ink-2">
                  <p className="mb-1 uppercase tracking-wider text-ink-3">Podle měny</p>
                  {s.byCurrency.map((c) => <p key={c.currency} className="flex justify-between"><span>{c.currency === "CZK" ? "v Kč" : fmtOrig(c.original, c.currency)}</span><span className="num">{kc(c.czk)}</span></p>)}
                </div>
              ) : null}
            </Card>
            {s.legsByMode.length > 0 && (
              <Card title="Doprava" className="lg:col-span-2">
                <div className="grid gap-2 sm:grid-cols-3">
                  {s.legsByMode.map((m) => { const I = MODE_ICON[m.mode]; return (
                    <div key={m.mode} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <I className="h-5 w-5 text-gold" />
                      <div className="text-sm"><p className="font-medium">{m.label} · {m.count}×</p><p className="text-xs text-ink-3">{m.km ? `${m.km.toLocaleString("cs-CZ")} km · ` : ""}{kc(m.price)}</p></div>
                    </div>
                  ); })}
                </div>
              </Card>
            )}
          </div>
        </>
      ) : <Card><EmptyState title="Zatím nic utraceno">Souhrn s grafy (za co, po dnech, kde, podle měny) se ukáže po prvních výdajích.</EmptyState></Card>)}
    </div>
  );
}
