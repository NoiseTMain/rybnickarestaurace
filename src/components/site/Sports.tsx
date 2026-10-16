import { TvIcon } from "@/components/ui/icons";
import { formatMenuDate, formatTime, pragueDateOf, shortWeekday } from "@/lib/time";
import type { SportEvent } from "@/lib/types";

export function SportList({ events, limit }: { events: SportEvent[]; limit?: number }) {
  const list = limit ? events.slice(0, limit) : events;
  if (!list.length) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/5 px-6 py-10 text-center text-paper/80">
        <TvIcon size={30} className="mx-auto text-amber-300" />
        <p className="mt-3 font-display text-xl text-paper">Program přenosů brzy zveřejníme</p>
        <p className="mt-1 text-sm">Na konkrétní zápas se můžete zeptat telefonicky.</p>
      </div>
    );
  }
  return (
    <ol className="grid gap-3">
      {list.map((e) => {
        const date = pragueDateOf(e.starts_at);
        return (
          <li key={e.id} className="flex gap-4 rounded-2xl border border-white/12 bg-white/[0.06] p-4 sm:items-center sm:p-5">
            <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl bg-amber-500 py-2 text-pond-950 sm:w-20">
              <span className="text-[0.7rem] font-bold tracking-wide uppercase">{shortWeekday(date)}</span>
              <span className="font-display text-xl leading-none font-semibold whitespace-nowrap">
                {formatMenuDate(date, { weekday: false, year: false })}
              </span>
              <span className="mt-0.5 text-sm font-semibold tabular-nums">{formatTime(e.starts_at)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.14em] text-amber-300 uppercase">{e.sport}</p>
              <p className="mt-1 font-display text-xl leading-snug text-paper">{e.title}</p>
              {e.description && <p className="mt-1 text-sm text-paper/70">{e.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
