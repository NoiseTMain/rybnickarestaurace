import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BedDouble, CalendarDays, MapPin, StickyNote, Users } from "lucide-react";
import { adminBackend, adminConfigured } from "@/lib/admin";
import { effectiveExpenses, MODE_LABEL, settle, summarizeTrip } from "@/lib/finance/travel";
import { formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { MODE_ICON } from "@/components/travel/icons";
import { TripMap, type MapLine, type MapPoint } from "@/components/travel/TripMap";

export const metadata = { title: "Sdílená cesta", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Veřejná stránka cesty jen pro čtení (odkaz se dá kdykoli vypnout). */
export default async function SharedTripPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!adminConfigured()) notFound();
  const data = await (await adminBackend()).sharedTrip(token);
  if (!data) notFound();
  const { trip, legs, plan, people } = data;
  const today = todayISO();
  const ex = effectiveExpenses(data.expenses, data.transactions);
  const s = summarizeTrip(trip, legs, ex, today);
  const st = people.length >= 2 ? settle(people, ex, data.settlements) : null;
  const points: MapPoint[] = trip.lat != null ? [{ lat: trip.lat, lon: trip.lon!, label: trip.destination, main: true }] : [];
  const lines: MapLine[] = legs.filter((l) => l.from_lat != null && l.to_lat != null).map((l) => ({ from: [l.from_lat!, l.from_lon!], to: [l.to_lat!, l.to_lon!], mode: l.mode, polyline: l.route_polyline, label: `${MODE_LABEL[l.mode]}: ${l.from_place} → ${l.to_place}` }));
  const days = [...new Set([...legs.map((l) => l.depart_date), ...plan.map((p) => p.date)].filter((x): x is string => Boolean(x)))].sort();
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div>
        <p className="text-xs text-ink-3">Sdílená cesta · jen pro čtení</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">{trip.name}</h1>
        <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-2">
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{trip.destination}{trip.country ? `, ${trip.country}` : ""}</span>
          {trip.start_date && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(trip.start_date)}{trip.end_date ? ` – ${formatDate(trip.end_date)}` : ""}</span>}
          {people.length > 0 && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{people.map((p) => p.name).join(", ")}</span>}
        </p>
      </div>
      {(points.length > 0 || lines.length > 0) && <TripMap points={points} lines={lines} height={280} />}
      {legs.length > 0 && (
        <section className="glass space-y-2 rounded-3xl p-4">
          <h2 className="font-semibold">Trasa</h2>
          {legs.map((l) => { const I = MODE_ICON[l.mode]; return (
            <p key={l.id} className="flex items-start gap-2 text-sm"><I className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><span><b>{l.from_place}</b> <ArrowRight className="inline h-3 w-3" /> <b>{l.to_place}</b><span className="block text-xs text-ink-3">{MODE_LABEL[l.mode]}{l.carrier ? ` · ${l.carrier}` : ""}{l.depart_date ? ` · ${formatDate(l.depart_date)}` : ""}{l.depart_time ? ` ${l.depart_time}` : ""}{l.arrive_time ? ` → ${l.arrive_time}` : ""}</span></span></p>
          ); })}
        </section>
      )}
      {days.length > 0 && plan.length > 0 && (
        <section className="glass space-y-3 rounded-3xl p-4">
          <h2 className="font-semibold">Program</h2>
          {days.map((d) => {
            const items = plan.filter((p) => p.date === d);
            if (!items.length) return null;
            return (
              <div key={d}>
                <p className="text-xs uppercase tracking-wider text-ink-3">{formatDate(d, "long")}</p>
                {items.map((p) => <p key={p.id} className="flex items-start gap-2 text-sm">{p.kind === "stay" ? <BedDouble className="mt-0.5 h-4 w-4 text-gold" /> : p.kind === "note" ? <StickyNote className="mt-0.5 h-4 w-4 text-gold" /> : <CalendarDays className="mt-0.5 h-4 w-4 text-gold" />}<span>{p.time ? `${p.time} · ` : ""}{p.title}{p.address && <span className="block text-xs text-ink-3">{p.address}</span>}</span></p>)}
              </div>
            );
          })}
        </section>
      )}
      {st && (
        <section className="glass space-y-2 rounded-3xl p-4">
          <h2 className="font-semibold">Kdo komu dluží</h2>
          <p className="text-xs text-ink-3">Utraceno celkem {formatMoney(s.paid, { decimals: "never" })}</p>
          {st.transfers.length ? st.transfers.map((t) => <p key={`${t.from}-${t.to}`} className="flex items-center gap-2 rounded-xl bg-gold/10 px-3 py-2 text-sm"><b>{t.fromName}</b><ArrowRight className="h-4 w-4 text-gold" /><b>{t.toName}</b><span className="num ml-auto font-semibold">{formatMoney(t.amount)}</span></p>) : <p className="text-sm text-ink-2">Vše je vyrovnané.</p>}
        </section>
      )}
      <p className="pt-4 text-center text-xs text-ink-3">Plánováno v <Link href="/vitejte" className="text-gold underline">HomeOS</Link> – rodinné finance a cestování.</p>
    </main>
  );
}
