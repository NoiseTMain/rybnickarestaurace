import Link from "next/link";
import { MapPin, Plane } from "lucide-react";
import type { Trip, TripLeg } from "@/lib/db/types";
import { STATUS_LABEL, type TripSummary } from "@/lib/finance/travel";
import { diffDays, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { MODE_ICON } from "@/components/travel/icons";
import { CardLink, KV } from "./bits";

export interface TripItem { trip: Trip; legs: TripLeg[]; s: TripSummary }

const kc = (c: number) => formatMoney(c, { decimals: "never" });
const dny = (n: number) => `${n} ${n === 1 ? "den" : n < 5 ? "dny" : "dní"}`;

/** Pruh nahoře v Přehledu, když je domácnost právě na cestě. */
export function OngoingTripBanner({ item, today }: { item: TripItem; today: string }) {
  const { trip, s } = item;
  const day = trip.start_date ? diffDays(trip.start_date, today) + 1 : null;
  return (
    <Link href={`/cestovani/${trip.id}`} className="block">
      <Card variant="light" className="!p-4 transition hover:border-gold/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold"><Plane className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">{trip.name} – {day && s.days ? `${day}. den z ${s.days}` : "právě na cestě"}</p>
            <p className="text-ink-2">Utraceno {kc(s.paid)}{s.budget != null ? ` z ${kc(s.budget)}` : ""}{s.daysLeft ? ` · zbývá ${dny(s.daysLeft)}` : ""}</p>
          </div>
          {s.perDayAllowance != null && (
            <div className="sm:text-right">
              <p className="text-[11px] uppercase tracking-wider text-ink-3">Dnes můžete utratit</p>
              <p className={`num text-2xl font-semibold ${s.spendingMoney != null && s.spendingMoney < 0 ? "text-neg" : "gold-text"}`}>{kc(s.perDayAllowance)}</p>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

/** Karta cestování v Přehledu: probíhající a chystané cesty, co ještě zaplatit, poslední cesta. */
export function TravelCard({ items, today, className }: { items: TripItem[]; today: string; className?: string }) {
  const year = today.slice(0, 4);
  const active = items.filter((x) => x.s.status === "ongoing" || x.s.status === "upcoming").sort((a, b) => (a.trip.start_date ?? "").localeCompare(b.trip.start_date ?? ""));
  const ideas = items.filter((x) => x.s.status === "idea");
  const finished = items.filter((x) => x.s.status === "finished").sort((a, b) => (b.trip.end_date ?? "").localeCompare(a.trip.end_date ?? ""));
  const spentThisYear = items.filter((x) => (x.trip.start_date ?? "").startsWith(year)).reduce((a, x) => a + x.s.paid, 0);
  const toPay = active.reduce((a, x) => a + x.s.plannedExpenses + x.s.unpaidLegs, 0);
  const reserve = active.reduce((a, x) => a + x.s.reserveNow, 0);
  const saving = active.reduce((a, x) => a + (x.s.monthlyAdd ?? 0), 0);
  const last = finished[0];
  return (
    <Card title="Cestování" subtitle={active.length ? `${active.length} ${active.length === 1 ? "chystaná cesta" : active.length < 5 ? "chystané cesty" : "chystaných cest"}` : "Kam pojedete příště?"} action={<CardLink href="/cestovani" />} className={className}>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">Zatím žádná cesta. <Link href="/cestovani" className="text-gold underline">Naplánovat cestu</Link> – trasu, dopravu i rozpočet na místě.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <div className="space-y-2">
            {active.slice(0, 3).map(({ trip, legs, s }) => {
              const modes = [...new Set(legs.map((l) => l.mode))];
              const used = s.budget ? Math.min(100, (s.total / s.budget) * 100) : null;
              return (
                <Link key={trip.id} href={`/cestovani/${trip.id}`} className="block rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-gold/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{trip.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-ink-3"><MapPin className="h-3 w-3 shrink-0" />{trip.destination} · {trip.start_date ? formatDate(trip.start_date) : ""}{modes.map((m) => { const I = MODE_ICON[m]; return <I key={m} className="ml-1 h-3 w-3" />; })}</p>
                    </div>
                    <Badge tone={s.status === "ongoing" ? "positive" : "gold"}>{s.status === "upcoming" && s.daysUntil != null ? (s.daysUntil === 0 ? "dnes" : `za ${s.daysUntil} d`) : STATUS_LABEL[s.status]}</Badge>
                  </div>
                  {used != null && <Progress className="mt-2" value={used} tone={s.overBudget ? "neg" : "gold"} label={`Rozpočet ${trip.name}`} />}
                  <p className="mt-1.5 text-xs text-ink-3">
                    {s.budget != null ? `${kc(s.total)} z ${kc(s.budget)}` : `zaplaceno ${kc(s.paid)}`}
                    {s.plannedExpenses + s.unpaidLegs > 0 ? ` · ještě zaplatit ${kc(s.plannedExpenses + s.unpaidLegs)}` : ""}
                    {s.perDayAllowance != null ? ` · na místě ${kc(s.perDayAllowance)}/den` : ""}
                  </p>
                </Link>
              );
            })}
            {!active.length && <p className="text-sm text-ink-3">Žádná naplánovaná cesta{ideas.length ? ` – v nápadech: ${ideas.map((x) => x.trip.destination).join(", ")}` : ""}.</p>}
          </div>
          <div className="space-y-0.5">
            <KV k="Ještě zaplatit" v={kc(toPay)} />
            {reserve > 0 && <KV k="Rezervováno teď" v={kc(reserve)} />}
            {saving > 0 && <KV k="Přidávat měsíčně" v={<span className="text-gold">{kc(saving)}</span>} />}
            <KV k={`Na cestách v roce ${year}`} v={kc(spentThisYear)} />
            <KV k="Navštíveno" v={`${finished.length} ${finished.length === 1 ? "cesta" : finished.length >= 2 && finished.length < 5 ? "cesty" : "cest"}`} />
            {last && (
              <Link href={`/cestovani/${last.trip.id}`} className="mt-2 block rounded-xl bg-white/[0.04] p-2.5 text-xs hover:bg-white/[0.07]">
                <span className="text-ink-3">Poslední: </span><b>{last.trip.destination}</b>
                <span className="block text-ink-2">utraceno {kc(last.s.paid)}{last.s.perDayActual != null ? ` · ${kc(last.s.perDayActual)}/den` : ""}{last.s.budget != null ? (last.s.paid > last.s.budget ? ` · přes rozpočet o ${kc(last.s.paid - last.s.budget)}` : ` · ušetřeno ${kc(last.s.budget - last.s.paid)}`) : ""}</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
