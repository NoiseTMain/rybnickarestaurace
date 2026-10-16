import { DAY_LABELS, isOpenNow, pragueWeekday } from "@/lib/time";
import type { OpeningDay } from "@/lib/types";

export function formatIntervals(day: OpeningDay | undefined): string {
  if (!day || day.closed || !day.intervals.length) return "Zavřeno";
  return day.intervals.map((i) => `${i.open}–${i.close}`).join(", ");
}

/** Tabulka otevírací doby se zvýrazněným dneškem (pražský čas). */
export function OpeningHours({
  hours,
  note,
  tone = "light",
}: {
  hours: OpeningDay[];
  note?: string | null;
  tone?: "light" | "dark";
}) {
  if (!hours.length) {
    return (
      <p className={tone === "dark" ? "text-paper/75" : "text-ink-soft"}>
        Aktuální otevírací dobu vám rádi sdělíme telefonicky.
      </p>
    );
  }
  const today = pragueWeekday();
  const sorted = [...hours].sort((a, b) => a.day - b.day);
  return (
    <div>
      <dl className="grid gap-1">
        {sorted.map((d) => {
          const isToday = d.day === today;
          return (
            <div
              key={d.day}
              className={`flex items-baseline justify-between gap-4 rounded-lg px-3 py-1.5 ${
                isToday ? (tone === "dark" ? "bg-white/10 font-semibold" : "bg-pond-50 font-semibold text-pond-900") : ""
              }`}
            >
              <dt>
                {DAY_LABELS[d.day]}
                {isToday && <span className="sr-only"> (dnes)</span>}
              </dt>
              <dd className="tabular-nums">{formatIntervals(d)}</dd>
            </div>
          );
        })}
      </dl>
      {note && <p className={`mt-3 text-sm ${tone === "dark" ? "text-paper/70" : "text-ink-soft"}`}>{note}</p>}
    </div>
  );
}

/** Odznak „Právě otevřeno / zavřeno“ – vykresluje se na serveru při každé revalidaci. */
export function OpenNowBadge({ hours }: { hours: OpeningDay[] }) {
  const open = isOpenNow(hours);
  if (open === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
        open ? "bg-pond-100 text-pond-800" : "bg-cream text-ink-soft"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${open ? "bg-pond-500" : "bg-ink-soft/50"}`} aria-hidden />
      {open ? "Dnes máme otevřeno" : "Teď máme zavřeno"}
    </span>
  );
}
