import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, ExternalLink, MapPin, PiggyBank, Ticket, Users } from "lucide-react";
import { canEdit, requireContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { loadTravel } from "@/lib/travel-data";
import { carrierSite, connectionLinks, effectiveExpenses, KIND_LABEL, MODE_LABEL, STATUS_LABEL, summarizeTrip } from "@/lib/finance/travel";
import { addDays, diffDays, formatDate } from "@/lib/dates";
import { divFloor, formatMoney, sum } from "@/lib/money";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { CategoryDonut, TripDaysChart } from "@/components/charts/Charts";
import { DeleteExpenseButton, DeleteTripButton, ExpenseButton, LegActions, LegButton, LinkTxRow, TripButton } from "@/components/travel/TripForms";
import { MODE_ICON } from "@/components/travel/icons";
import { TripMap, type MapLine, type MapPoint } from "@/components/travel/TripMap";

export const metadata = { title: "Cesta" };

const Stat = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) => (
  <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">{label}</p>{children}{hint && <p className="mt-0.5 text-[11px] text-ink-3">{hint}</p>}</Card>
);

const fmtOrig = (v: number, cur: string) => `${(v / 100).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} ${cur}`;

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const [{ data, snapshot, today }, tr] = await Promise.all([loadSnapshot(ctx), loadTravel(ctx)]);
  const trip = tr.trips.find((t) => t.id === id);
  if (!trip) notFound();
  const edit = canEdit(ctx, "travel");
  const legs = tr.legs.filter((l) => l.trip_id === id);
  const expenses = effectiveExpenses(tr.expenses.filter((e) => e.trip_id === id), data.transactions);
  const s = summarizeTrip(trip, legs, expenses, today);
  const paidLeg = new Map(expenses.filter((e) => e.leg_id).map((e) => [e.leg_id!, e]));
  const planned = expenses.filter((e) => e.status === "planned");
  const paid = expenses.filter((e) => e.status === "paid");

  // denní limit na útratu na místě = rozpočet bez dopravy a ubytování / počet dní
  const fixedCosts = sum(expenses.filter((e) => e.kind === "transport" || e.kind === "accommodation"), (e) => e.value) + s.unpaidLegs;
  const dailyLimit = trip.budget != null && s.days ? divFloor(Math.max(0, trip.budget - fixedCosts), s.days) : null;
  // útrata na místě po dnech cesty (bez dopravy a ubytování, jen dny cesty)
  const tripEnd = trip.end_date ?? trip.start_date;
  const onSite = new Map<string, number>();
  if (trip.start_date && tripEnd) {
    for (let d = trip.start_date; d <= tripEnd && d <= (s.status === "finished" ? tripEnd : today); d = addDays(d, 1)) onSite.set(d, 0);
    for (const e of paid) if (e.date && onSite.has(e.date) && e.kind !== "transport" && e.kind !== "accommodation") onSite.set(e.date, onSite.get(e.date)! + e.value);
  }
  const dayLabel = (d: string) => (trip.start_date && d >= trip.start_date && (!trip.end_date || d <= trip.end_date) ? `${diffDays(trip.start_date, d) + 1}. den` : formatDate(d));

  // platby z účtu v termínu cesty, které ještě nejsou přiřazené
  const linked = new Set(tr.expenses.map((e) => e.transaction_id).filter(Boolean));
  const candidates = trip.start_date
    ? data.transactions.filter((t) => t.type === "expense" && t.status === "posted" && !linked.has(t.id) && t.date >= addDays(trip.start_date!, -2) && t.date <= addDays(trip.end_date ?? trip.start_date!, 1))
    : [];


  const points: MapPoint[] = trip.lat != null ? [{ lat: trip.lat, lon: trip.lon!, label: trip.destination, main: true }] : [];
  const lines: MapLine[] = legs.filter((l) => l.from_lat != null && l.to_lat != null).map((l) => ({ from: [l.from_lat!, l.from_lon!], to: [l.to_lat!, l.to_lon!], mode: l.mode, label: `${MODE_LABEL[l.mode]}${l.carrier ? ` · ${l.carrier}` : ""}: ${l.from_place} → ${l.to_place}` }));
  const banner = s.status === "upcoming" ? (s.daysUntil === 0 ? "Odjezd je dnes – šťastnou cestu!" : `Odjezd za ${s.daysUntil} ${s.daysUntil === 1 ? "den" : s.daysUntil! < 5 ? "dny" : "dní"}`)
    : s.status === "ongoing" ? `Právě jste na cestě – ${diffDays(trip.start_date!, today) + 1}. den z ${s.days}`
    : s.status === "finished" ? "Cesta skončila – níže je kompletní přehled, kolik se kde a za co utratilo."
    : "Zatím jen nápad – doplňte termín a rozpočet.";

  return (
    <div className="space-y-4">
      <ReadOnlyNotice ctx={ctx} section="travel" />
      <Link href="/cestovani" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-gold"><ArrowLeft className="h-4 w-4" />Cestování</Link>
      <PageHeader
        title={trip.name}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{trip.destination}{trip.country ? `, ${trip.country}` : ""}</span><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{trip.start_date ? `${formatDate(trip.start_date)}${trip.end_date ? ` – ${formatDate(trip.end_date)}` : ""}` : "bez termínu"}</span><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{trip.travelers} {trip.travelers === 1 ? "osoba" : trip.travelers < 5 ? "osoby" : "osob"}</span></span>}
        actions={edit ? <div className="flex gap-2"><TripButton initial={trip} label="Upravit" variant="secondary" /><DeleteTripButton id={trip.id} /></div> : null}
      />
      <div className={`rounded-2xl border px-4 py-2.5 text-sm ${s.status === "ongoing" ? "border-pos/30 bg-pos/10 text-pos" : s.status === "finished" ? "border-white/10 bg-white/[0.04] text-ink-2" : "border-gold/30 bg-gold/10 text-gold-bright"}`}>
        <Badge tone={s.status === "ongoing" ? "positive" : s.status === "finished" ? "neutral" : "gold"} className="mr-2">{STATUS_LABEL[s.status]}</Badge>{banner}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Rozpočet" hint={s.budget != null && s.days ? `${formatMoney(divFloor(s.budget, s.days), { decimals: "never" })} na den` : "nenastaven"}>{s.budget != null ? <Money value={s.budget} decimals="never" className="text-xl font-semibold" /> : <p className="text-xl text-ink-3">—</p>}</Stat>
        <Stat label="Zaplaceno" hint={`${formatMoney(s.perPerson, { decimals: "never" })} na osobu`}><Money value={s.paid} decimals="never" className="text-xl font-semibold" /></Stat>
        <Stat label="Ještě zaplatit" hint={s.unpaidLegs ? `z toho doprava ${formatMoney(s.unpaidLegs, { decimals: "never" })}` : "naplánované výdaje"}><Money value={s.plannedExpenses + s.unpaidLegs} decimals="never" className="text-xl font-semibold" /></Stat>
        <Stat label={s.status === "finished" ? "Zbylo z rozpočtu" : "Na útratu na místě"} hint={s.perDayAllowance != null && s.status !== "finished" ? <>≈ <b className="text-ink">{formatMoney(s.perDayAllowance, { decimals: "never" })}</b> na den{s.status === "ongoing" ? " (zbývající dny)" : ""}</> : s.budget == null ? "zadejte rozpočet" : undefined}>
          {s.spendingMoney != null ? <Money value={s.spendingMoney} decimals="never" colored={s.spendingMoney < 0} className="gold-text text-xl font-semibold" /> : <p className="text-xl text-ink-3">—</p>}
        </Stat>
      </div>
      {s.budget != null && s.budget > 0 && (
        <Progress value={Math.min(100, (s.total / s.budget) * 100)} marker={Math.min(100, (s.paid / s.budget) * 100)} tone={s.overBudget ? "neg" : "gold"} label={s.overBudget ? `Plán překračuje rozpočet o ${formatMoney(s.total - s.budget, { decimals: "never" })}` : `Rozpočet využit z ${Math.round((s.total / s.budget) * 100)} % (zaplaceno + naplánováno)`} />
      )}

      {(s.status === "upcoming" || s.status === "ongoing") && s.toCover > 0 && (
        <Card className="!p-4">
          <div className="flex gap-3">
            <PiggyBank className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <div className="space-y-1 text-sm">
              <p>{s.status === "ongoing" ? "Do konce cesty počítáte ještě s" : "Cesta bude stát ještě"} <b>{formatMoney(s.toCover, { decimals: "never" })}</b>{s.budget != null ? " (do výše rozpočtu)" : ""}. Plánovač s tím počítá:</p>
              <ul className="space-y-0.5 text-ink-2">
                {s.dueThisMonth > 0 && <li>• <b className="text-ink">{formatMoney(s.dueThisMonth, { decimals: "never" })}</b> splatné do konce měsíce je v nadcházejících platbách</li>}
                {s.reserveNow > 0 && <li>• <b className="text-ink">{formatMoney(s.reserveNow, { decimals: "never" })}</b> je teď drženo stranou jako rezerva na cestu</li>}
                {s.monthlyAdd != null && s.monthlyAdd > 0 && s.monthsLeft != null && <li>• rezerva se bude navyšovat o <b className="gold-text">{formatMoney(s.monthlyAdd, { decimals: "never" })} měsíčně</b> ({s.monthsLeft} {s.monthsLeft === 1 ? "měsíc" : s.monthsLeft < 5 ? "měsíce" : "měsíců"} do odjezdu)</li>}
              </ul>
              <p className="text-xs text-ink-3">Obojí je už odečtené od „Volné k utracení“ ({formatMoney(snapshot.planner.safeToSpend, { decimals: "never" })}). Očekávané příjmy se nemění.</p>
              {snapshot.planner.needToEarn > 0 && <p className="text-warn">Na všechny plány tohoto měsíce teď chybí {formatMoney(snapshot.planner.needToEarn, { decimals: "never" })}.</p>}
            </div>
          </div>
        </Card>
      )}

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
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {l.price != null && <Money value={pe ? pe.value : l.price} decimals="never" className="font-semibold" />}
                      {pe ? <Badge tone="positive">zaplaceno</Badge> : l.price != null ? <Badge tone="warning">nezaplaceno</Badge> : null}
                    </div>
                  </div>
                  {edit && (
                    <div className="mt-2 flex items-center justify-end gap-1 border-t border-white/[0.06] pt-2">
                      {!pe && <ExpenseButton trip={trip} leg={l} label="Zaplaceno" size="sm" variant="ghost" />}
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

      <Card title="Výdaje na cestě" subtitle="Ubytování, jídlo, výlety… i v cizí měně s kurzem ČNB" action={edit ? <div className="flex gap-1"><ExpenseButton trip={trip} planned label="Naplánovat" size="sm" variant="ghost" /><ExpenseButton trip={trip} label="Výdaj" size="sm" variant="primary" /></div> : null}>
        {planned.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-xs uppercase tracking-wider text-ink-3">Naplánováno</p>
            <ul>
              {planned.map((e) => (
                <li key={e.id} className="flex items-center gap-2 border-t border-white/[0.06] py-2 text-sm">
                  <span className="min-w-0 flex-1"><span className="block truncate">{e.description}</span><span className="text-xs text-ink-3">{KIND_LABEL[e.kind]}{e.place ? ` · ${e.place}` : ""}{e.date ? ` · do ${formatDate(e.date)}` : ""}</span></span>
                  <span className="text-right"><Money value={e.value} decimals="never" />{e.currency !== "CZK" && e.amount_original != null && <span className="block text-[11px] text-ink-3">{fmtOrig(e.amount_original, e.currency)}</span>}</span>
                  {edit && <><ExpenseButton trip={trip} initial={e} icon="pay" label="Zaplatit" size="sm" variant="secondary" /><ExpenseButton trip={trip} initial={e} icon="edit" size="icon" variant="ghost" /><DeleteExpenseButton e={e} /></>}
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
                <span className="min-w-0 flex-1"><span className="block truncate">{e.description}</span><span className="text-xs text-ink-3">{KIND_LABEL[e.kind]}{e.place ? ` · ${e.place}` : ""}{e.transaction_id ? " · v příjmech a výdajích" : ""}</span></span>
                <span className="text-right"><Money value={e.value} />{e.currency !== "CZK" && e.amount_original != null && <span className="block text-[11px] text-ink-3">{fmtOrig(e.amount_original, e.currency)}{e.rate ? ` · kurz ${Number(e.rate).toLocaleString("cs-CZ", { maximumFractionDigits: 3 })}` : ""}</span>}</span>
                {edit && <><ExpenseButton trip={trip} initial={e} icon="edit" size="icon" variant="ghost" /><DeleteExpenseButton e={e} /></>}
              </li>
            ))}
          </ul>
        ) : !planned.length ? (
          <p className="py-4 text-center text-sm text-ink-3">Zatím žádné výdaje. Na cestě zapisujte útraty – i v eurech, kurz se doplní sám.</p>
        ) : null}
        {edit && candidates.length > 0 && (
          <details className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <summary className="cursor-pointer text-sm text-ink-2">Platby z účtu v termínu cesty ({candidates.length}) – přiřadit k cestě</summary>
            <ul className="mt-2">{candidates.slice(0, 40).map((t) => <LinkTxRow key={t.id} tripId={trip.id} tx={{ id: t.id, date: t.date, description: t.description, amount: t.amount, category: data.categories.find((c) => c.id === t.category_id)?.name ?? null }} />)}</ul>
          </details>
        )}
      </Card>

      {paid.length > 0 && (
        <>
          <h2 className="pt-2 font-[family-name:var(--font-display)] text-lg font-semibold">{s.status === "finished" ? "Souhrn cesty" : "Zatím utraceno"}</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Utraceno celkem"><Money value={s.paid} decimals="never" className="gold-text text-xl font-semibold" /></Stat>
            <Stat label="Průměr na den">{s.perDayActual != null ? <Money value={s.perDayActual} decimals="never" className="text-xl font-semibold" /> : <p className="text-xl text-ink-3">—</p>}</Stat>
            <Stat label="Na osobu"><Money value={s.perPerson} decimals="never" className="text-xl font-semibold" /></Stat>
            <Stat label="Oproti rozpočtu">{s.budget != null ? <Money value={s.budget - s.paid} sign decimals="never" colored className="text-xl font-semibold" /> : <p className="text-xl text-ink-3">—</p>}</Stat>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Za co"><CategoryDonut data={s.byKind.map((k) => ({ name: k.label, amount: k.amount }))} /></Card>
            <Card title="Po dnech" subtitle={`Útrata na místě (bez dopravy a ubytování)${dailyLimit != null ? ` · denní limit ${formatMoney(dailyLimit, { decimals: "never" })}` : ""}`}>
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
                  {s.byCurrency.map((c) => <p key={c.currency} className="flex justify-between"><span>{c.currency === "CZK" ? "v Kč" : fmtOrig(c.original, c.currency)}</span><span className="num">{formatMoney(c.czk, { decimals: "never" })}</span></p>)}
                </div>
              ) : null}
            </Card>
            {s.legsByMode.length > 0 && (
              <Card title="Doprava" className="lg:col-span-2">
                <div className="grid gap-2 sm:grid-cols-3">
                  {s.legsByMode.map((m) => { const I = MODE_ICON[m.mode]; return (
                    <div key={m.mode} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <I className="h-5 w-5 text-gold" />
                      <div className="text-sm"><p className="font-medium">{m.label} · {m.count}×</p><p className="text-xs text-ink-3">{m.km ? `${m.km.toLocaleString("cs-CZ")} km · ` : ""}{formatMoney(m.price, { decimals: "never" })}</p></div>
                    </div>
                  ); })}
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
