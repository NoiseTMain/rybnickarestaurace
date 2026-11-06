import { cn } from "./cn";

/** Ukazatel plnění. Nad 100 % se zbarví varovně; volitelně značka „kde bychom měli být“. */
export function Progress({ value, marker, tone = "gold", className, label }: { value: number; marker?: number; tone?: "gold" | "pos" | "warn" | "neg"; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const fill = { gold: "from-gold-deep via-gold to-gold-bright", pos: "from-emerald-700 to-pos", warn: "from-amber-700 to-warn", neg: "from-red-800 to-neg" }[tone];
  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-white/[0.07]", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-700", fill)} style={{ width: `${v}%` }} />
      {marker != null && marker > 0 && marker < 100 && (
        <div className="absolute top-[-2px] h-[12px] w-[2px] rounded bg-ink/80" style={{ left: `${marker}%` }} title="Plán k dnešku" />
      )}
    </div>
  );
}

/** Segmentový ukazatel jako na referenčním dashboardu (svislé pilulky). */
export function PillBars({ values, highlight }: { values: { label: string; value: number }[]; highlight?: number }) {
  const max = Math.max(1, ...values.map((v) => v.value));
  return (
    <div className="flex h-24 items-end gap-2">
      {values.map((v, i) => (
        <div key={v.label} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="relative flex h-20 w-full max-w-7 items-end overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={cn("w-full rounded-full", i === highlight ? "bg-gradient-to-t from-gold-deep to-gold-bright" : "bg-gradient-to-t from-zinc-700 to-zinc-400")}
              style={{ height: `${Math.max(6, (v.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-ink-3">{v.label}</span>
        </div>
      ))}
    </div>
  );
}
