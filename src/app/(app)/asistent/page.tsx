import { requireContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { buildInsights } from "@/lib/assistant";
import { anomalies, forecast, savingsTips, weeklySummary, workInsights } from "@/lib/finance/insights";
import { aiEnabled } from "@/lib/ai";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui/Card";
import { InsightItem } from "@/components/dashboard/bits";
import { AssistantChat } from "./AssistantChat";

export const metadata = { title: "Finanční asistent" };

export default async function AssistantPage() {
  const ctx = await requireContext();
  const { data, snapshot: s } = await loadSnapshot(ctx);
  const insights = buildInsights(s, data);
  const weekly = weeklySummary(s, data);
  const odd = anomalies(s, data);
  const tips = savingsTips(s, data);
  const fc = data.accounts.length ? forecast(s, data, 3) : null;
  const work = workInsights(data, s.today);
  const fm = (c: number) => formatMoney(c, { decimals: "never" });
  return (
    <div className="space-y-4">
      <PageHeader title="Finanční asistent" subtitle="Analýza vašich skutečných dat – žádné odhady z ničeho. Když údaje chybí, asistent se doptá." />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card variant="dark" title="Zeptejte se" subtitle="Odpovědi se počítají z databáze v okamžiku dotazu">
          <AssistantChat aiEnabled={aiEnabled()} />
        </Card>
        <div className="space-y-4">
          <Card title={weekly.title} subtitle="Posledních 7 dní a co vás čeká">
            <ul className="space-y-1.5 text-sm text-ink-2">{weekly.lines.map((l) => <li key={l}>• {l}</li>)}</ul>
          </Card>
          <Card title="Doporučení a upozornění" subtitle={`${insights.length} postřehů`}>
            <div className="space-y-2">{insights.map((i) => <InsightItem key={i.id} i={i} />)}</div>
            {!insights.length && <p className="text-sm text-ink-3">Zatím nemám dost dat.</p>}
          </Card>
        </div>
      </div>

      {fc && (
        <Card title="Výhled na 3 měsíce" subtitle={`Včetně očekávaných příjmů · ${fc.basis}`}>
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink-3"><tr><th className="px-4 py-2 font-medium sm:px-5">Měsíc</th><th className="text-right font-medium">Příjmy</th><th className="text-right font-medium">Pevné platby</th><th className="text-right font-medium">Běžné výdaje</th><th className="text-right font-medium">Spoření</th><th className="px-4 text-right font-medium sm:px-5">Na konci</th></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {fc.months.map((m) => (
                  <tr key={m.start} className={fc.tightest?.start === m.start ? "bg-white/[0.03]" : ""}>
                    <td className="px-4 py-2 sm:px-5">{m.label}{fc.tightest?.start === m.start && <span className="ml-2 text-[10px] text-warn">nejtěsnější</span>}</td>
                    <td className="num text-right text-pos">{fm(m.income)}</td><td className="num text-right">{fm(m.fixed)}</td><td className="num text-right">{fm(m.variable)}</td><td className="num text-right">{fm(m.savings)}</td>
                    <td className={`num px-4 text-right font-medium sm:px-5 ${m.endBalance < 0 ? "text-neg" : ""}`}>{fm(m.endBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-3">Odhad. Výchozí stav = předpokládaný zůstatek na konci tohoto měsíce ({fm(s.projectedEndOfMonth)}). Očekávané příjmy se do „bezpečně k utracení“ dál nepočítají.</p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Neobvyklé věci" subtitle="Duplicity, výkyvy, předplatné, energie, výplaty">
          {odd.length ? <ul className="space-y-2 text-sm">{odd.map((a) => <li key={a.id} className={a.tone === "danger" ? "text-neg" : a.tone === "warning" ? "text-warn" : "text-ink-2"}>• {a.title}{a.detail && <span className="block text-xs text-ink-3">{a.detail}</span>}</li>)}</ul> : <p className="text-sm text-ink-3">Nic neobvyklého.</p>}
        </Card>
        <Card title="Kde ušetřit" subtitle="Konkrétně a s čísly">
          {tips.length ? <ul className="space-y-2 text-sm text-ink-2">{tips.map((t) => <li key={t.id}>• {t.title}</li>)}</ul> : <p className="text-sm text-ink-3">Výdaje jsou blízko vašemu průměru.</p>}
        </Card>
        <Card title="Postřehy z práce" subtitle="Za posledních 120 dní">
          {work.length ? <ul className="space-y-2 text-sm text-ink-2">{work.map((w) => <li key={w}>• {w}</li>)}</ul> : <p className="text-sm text-ink-3">Zatím málo směn pro postřehy.</p>}
        </Card>
      </div>
    </div>
  );
}
