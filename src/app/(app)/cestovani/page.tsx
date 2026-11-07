import Link from "next/link";
import { CalendarDays, Globe2, MapPin, Users } from "lucide-react";
import { requireContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { loadTravel } from "@/lib/travel-data";
import { effectiveExpenses, STATUS_LABEL, summarizeTrip, type TripSummary } from "@/lib/finance/travel";
import { formatDate } from "@/lib/dates";
import { formatMoney, sum } from "@/lib/money";
import type { Trip, TripLeg } from "@/lib/db/types";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { FilterTabs } from "@/components/lists/Filters";
import { TripButton } from "@/components/travel/TripForms";
import { MODE_ICON } from "@/components/travel/icons";
import { TripMap } from "@/components/travel/TripMap";

export const metadata = { title: "Cestování" };

const dates = (t: Trip) => (t.start_date ? `${formatDate(t.start_date)}${t.end_date && t.end_date !== t.start_date ? ` – ${formatDate(t.end_date)}` : ""}` : "termín zatím neurčen");

function TripCard({ trip, s, legs }: { trip: Trip; s: TripSummary; legs: TripLeg[] }) {
  const modes = [...new Set(legs.map((l) => l.mode))];
  const tone = s.status === "ongoing" ? "positive" : s.status === "upcoming" ? "gold" : s.status === "finished" ? "neutral" : "info";
  return (
    <Link href={`/cestovani/${trip.id}`} className="block">
      <Card className="h-full transition hover:border-gold/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{trip.name}</p>
            <p className="flex items-center gap-1 truncate text-sm text-ink-2"><MapPin className="h-3.5 w-3.5 shrink-0" />{trip.destination}{trip.country ? `, ${trip.country}` : ""}</p>
          </div>
          <Badge tone={tone}>{s.status === "upcoming" && s.daysUntil != null ? (s.daysUntil === 0 ? "dnes" : `za ${s.daysUntil} d`) : STATUS_LABEL[s.status]}</Badge>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{dates(trip)}{s.days ? ` · ${s.days} ${s.days === 1 ? "den" : s.days < 5 ? "dny" : "dní"}` : ""}</span>
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{trip.travelers}</span>
          {modes.map((m) => { const I = MODE_ICON[m]; return <I key={m} className="h-3.5 w-3.5" />; })}
        </p>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-ink-3">{s.status === "finished" ? "Utraceno" : "Zaplaceno + plán"}</span>
            <span className="num">{formatMoney(s.status === "finished" ? s.paid : s.total, { decimals: "never" })}{s.budget != null && <span className="text-ink-3"> / {formatMoney(s.budget, { decimals: "never" })}</span>}</span>
          </div>
          {s.budget != null && s.budget > 0 && <Progress value={Math.min(100, ((s.status === "finished" ? s.paid : s.total) / s.budget) * 100)} tone={s.overBudget ? "neg" : "gold"} />}
        </div>
      </Card>
    </Link>
  );
}

export default async function TravelPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const [{ data, today }, tr] = await Promise.all([loadSnapshot(ctx), loadTravel(ctx)]);
  const all = tr.trips.map((t) => {
    const legs = tr.legs.filter((l) => l.trip_id === t.id);
    const ex = effectiveExpenses(tr.expenses.filter((e) => e.trip_id === t.id), data.transactions);
    return { trip: t, legs, s: summarizeTrip(t, legs, ex, today) };
  });
  const tab = sp.tab ?? "";
  const active = all.filter((x) => x.s.status !== "finished").sort((a, b) => (a.trip.start_date ?? "9999").localeCompare(b.trip.start_date ?? "9999"));
  const finished = all.filter((x) => x.s.status === "finished");

  const header = (
    <>
      <ReadOnlyNotice ctx={ctx} section="travel" />
      <PageHeader title="Cestování" subtitle="Kam pojedete, čím, za kolik – a po návratu přehled, kde a za co se utratilo" actions={<TripButton label="Nová cesta" />} />
      <FilterTabs name="tab" options={[{ value: "", label: "Cesty", count: active.length }, { value: "navstivene", label: "Kde jsme byli", count: finished.length }]} />
    </>
  );

  if (tab === "navstivene") {
    const totalSpent = sum(finished, (x) => x.s.paid);
    const totalDays = finished.reduce((a, x) => a + (x.s.days ?? 0), 0);
    const countries = new Set(finished.map((x) => x.trip.country?.trim().toLowerCase()).filter(Boolean));
    const points = finished.filter((x) => x.trip.lat != null).map((x) => ({ lat: x.trip.lat!, lon: x.trip.lon!, label: `${x.trip.destination} (${x.trip.start_date?.slice(0, 4) ?? ""})` }));
    return (
      <div className="space-y-4">
        {header}
        {finished.length ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Cest</p><p className="text-xl font-semibold">{finished.length}</p></Card>
              <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Dní na cestách</p><p className="text-xl font-semibold">{totalDays}</p></Card>
              <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Zemí</p><p className="text-xl font-semibold">{countries.size}</p></Card>
              <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Utraceno celkem</p><Money value={totalSpent} decimals="never" className="gold-text text-xl font-semibold" /></Card>
            </div>
            {points.length > 0 && <Card title="Mapa navštívených míst"><TripMap points={points} lines={[]} height={340} /></Card>}
            <Card title="Navštívené destinace" bodyClassName="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-xs text-ink-3"><tr><th className="py-1 text-left font-medium">Kam</th><th className="text-left font-medium">Kdy</th><th className="text-right font-medium">Dní</th><th className="text-right font-medium">Utraceno</th><th className="text-right font-medium">Za den</th><th className="text-right font-medium">Rozpočet</th></tr></thead>
                <tbody>
                  {finished.map(({ trip, s }) => (
                    <tr key={trip.id} className="border-t border-white/[0.06]">
                      <td className="py-2"><Link href={`/cestovani/${trip.id}`} className="hover:text-gold"><b>{trip.destination}</b>{trip.country && <span className="text-ink-3">, {trip.country}</span>}<span className="block text-xs text-ink-3">{trip.name}</span></Link></td>
                      <td className="text-xs text-ink-2">{dates(trip)}</td>
                      <td className="num text-right">{s.days ?? "—"}</td>
                      <td className="num text-right">{formatMoney(s.paid, { decimals: "never" })}</td>
                      <td className="num text-right">{s.perDayActual != null ? formatMoney(s.perDayActual, { decimals: "never" }) : "—"}</td>
                      <td className={`num text-right ${s.budget != null && s.paid > s.budget ? "text-neg" : "text-ink-2"}`}>{s.budget != null ? formatMoney(s.budget, { decimals: "never" }) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        ) : (
          <Card><EmptyState title="Zatím žádná dokončená cesta">Po návratu z cesty se tu objeví destinace s mapou, kolik jste kde utratili a průměr za den.</EmptyState></Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      {active.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{active.map((x) => <TripCard key={x.trip.id} {...x} />)}</div>
      ) : (
        <Card><EmptyState title="Žádná naplánovaná cesta" action={<TripButton label="Naplánovat cestu" />}>Zadejte, kam pojedete a s jakým rozpočtem. Pak přidáte trasu (vlak, autobus, auto, letadlo – i s dopravcem a cenou) a uvidíte, kolik můžete utratit na místě za den.</EmptyState></Card>
      )}
      {finished.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink-2"><Globe2 className="h-4 w-4" />Nedávné cesty</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{finished.slice(0, 3).map((x) => <TripCard key={x.trip.id} {...x} />)}</div>
        </div>
      )}
    </div>
  );
}
