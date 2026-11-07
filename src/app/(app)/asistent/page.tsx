import { requireContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { buildInsights } from "@/lib/assistant";
import { anomalies, lookback, savingsTips, weeklySummary, workInsights } from "@/lib/finance/insights";
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
  const lb = lookback(s, data, 3);
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

      <Card title="Poslední 3 měsíce" subtitle="Skutečné příjmy, výdaje a odložené peníze za uplynulé měsíce">
        {lb.average ? (
          <>
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-ink-3"><tr><th className="px-4 py-2 font-medium sm:px-5">Měsíc</th><th className="text-right font-medium">Příjmy</th><th className="text-right font-medium">Pevné platby</th><th className="text-right font-medium">Běžné výdaje</th><th className="text-right font-medium">Odloženo</th><th className="text-right font-medium">Bilance</th><th className="px-4 text-right font-medium sm:px-5">Zůstatek na konci</th></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {lb.months.map((m) => (
                    <tr key={m.start}>
                      <td className="px-4 py-2 sm:px-5">{m.label}</td>
                      {m.hasData ? <>
                        <td className="num text-right text-pos">{fm(m.income)}</td><td className="num text-right">{fm(m.fixed)}</td><td className="num text-right">{fm(m.variable)}</td><td className="num text-right">{fm(m.saved)}</td>
                        <td className={`num text-right font-medium ${m.net < 0 ? "text-neg" : "text-pos"}`}>{m.net > 0 ? "+" : ""}{fm(m.net)}</td>
                        <td className="num px-4 text-right sm:px-5">{m.endBalance != null ? fm(m.endBalance) : "—"}</td>
                      </> : <td colSpan={6} className="px-4 text-right text-xs text-ink-3 sm:px-5">bez evidence</td>}
                    </tr>
                  ))}
                  <tr className="bg-white/[0.03] text-ink-2">
                    <td className="px-4 py-2 text-xs uppercase tracking-wider sm:px-5">Průměr / měsíc</td>
                    <td className="num text-right">{fm(lb.average.income)}</td><td className="num text-right">{fm(lb.average.fixed)}</td><td className="num text-right">{fm(lb.average.variable)}</td><td className="num text-right">{fm(lb.average.saved)}</td>
                    <td className="num text-right font-medium">{lb.average.net > 0 ? "+" : ""}{fm(lb.average.net)}</td><td />
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-ink-3">Pevné platby = pravidelné platby a faktury, běžné výdaje = vše ostatní. Podrobnosti po kategoriích najdete v Příjmy a výdaje → Historie měsíců.</p>
          </>
        ) : <p className="text-sm text-ink-3">Za uplynulé 3 měsíce zatím nejsou žádná data – evidence začala teprve tento měsíc.</p>}
      </Card>

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
