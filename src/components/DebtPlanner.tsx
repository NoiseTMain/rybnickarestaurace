"use client";
import { useMemo, useState } from "react";
import { debtPlan, type DebtInput } from "@/lib/finance/debt-plan";
import { formatMoney, parseMoney } from "@/lib/money";
import { addMonths } from "@/lib/dates";
import { DebtPayoffChart } from "@/components/charts/Charts";
import { Input } from "@/components/ui/Field";

const kc = (c: number) => formatMoney(c, { decimals: "never" });

export function DebtPlanner({ debts, today }: { debts: DebtInput[]; today: string }) {
  const [extraText, setExtra] = useState("1000");
  const extra = Math.max(0, parseMoney(extraText) ?? 0);
  const { av, sb, base, data } = useMemo(() => {
    const av = debtPlan(debts, extra, "avalanche"), sb = debtPlan(debts, extra, "snowball"), base = debtPlan(debts, 0, "avalanche");
    const n = Math.max(av.timeline.length, sb.timeline.length);
    const step = Math.max(1, Math.ceil(n / 60));
    const total = debts.reduce((a, d) => a + d.balance, 0);
    const data = [{ month: 0, avalanche: total, snowball: total }];
    for (let i = step - 1; i < n; i += step) data.push({ month: i + 1, avalanche: av.timeline[i] ?? 0, snowball: sb.timeline[i] ?? 0 });
    return { av, sb, base, data };
  }, [debts, extra]);
  const when = (m: number) => { const d = addMonths(today, m); return `${Number(d.slice(5, 7))}/${d.slice(0, 4)}`; };
  if (av.impossible) return <p className="text-sm text-neg">Se zadanými splátkami se dluhy nesplatí – splátky nepokryjí ani úroky. Zvyšte měsíční splátku nebo částku navíc.</p>;
  const best = av.totalInterest <= sb.totalInterest ? "avalanche" : "snowball";
  return (
    <div className="space-y-4">
      <Input label="Kolik můžu měsíčně dát navíc ke splátkám (Kč)" inputMode="decimal" value={extraText} onChange={(e) => setExtra(e.target.value)} className="max-w-xs" />
      <div className="grid gap-3 sm:grid-cols-2">
        {([["avalanche", "Lavina", "nejdřív dluh s nejvyšším úrokem – zaplatíte nejméně", av], ["snowball", "Sněhová koule", "nejdřív nejmenší dluh – rychlé první úspěchy", sb]] as const).map(([k, title, hint, r]) => (
          <div key={k} className={`rounded-2xl p-3 ${best === k ? "bg-gold/10 ring-1 ring-gold/40" : "bg-black/25"}`} data-testid={`plan-${k}`}>
            <p className="text-sm font-semibold">{title}{best === k && <span className="ml-2 text-xs text-gold">doporučeno</span>}</p>
            <p className="text-xs text-ink-3">{hint}</p>
            <p className="mt-2 text-sm">Bez dluhů za <b>{r.months} měs.</b> ({when(r.months)})</p>
            <p className="text-sm">Úroky celkem <b className="num">{kc(r.totalInterest)}</b></p>
            <ol className="mt-2 space-y-0.5 text-xs text-ink-2">{r.payoff.map((p, i) => <li key={p.id}>{i + 1}. {p.name} – splaceno {when(p.month)}</li>)}</ol>
          </div>
        ))}
      </div>
      {!base.impossible && extra > 0 && <p className="text-sm text-ink-2">Díky {kc(extra)} navíc měsíčně budete bez dluhů o <b>{base.months - av.months} měs.</b> dřív a ušetříte <b className="text-pos">{kc(base.totalInterest - av.totalInterest)}</b> na úrocích.</p>}
      <DebtPayoffChart data={data} />
    </div>
  );
}
