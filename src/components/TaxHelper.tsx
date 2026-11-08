"use client";
import { useMemo, useState } from "react";
import { FLAT_EXPENSES, TAX_PARAMS_2026, osvcTax } from "@/lib/finance/tax-cz";
import { formatMoney, parseMoney } from "@/lib/money";
import { Input, Select } from "@/components/ui/Field";

const kc = (n: number) => formatMoney(n * 100, { decimals: "never" });

export function TaxHelper({ issued, received }: { issued: number; received: number }) {
  const [income, setIncome] = useState(String(Math.round(issued / 100)));
  const [mode, setMode] = useState("60");
  const [real, setReal] = useState(String(Math.round(received / 100)));
  const [kids, setKids] = useState("0");
  const [p, setP] = useState(TAX_PARAMS_2026);
  const r = useMemo(() => {
    const k = Number(kids) || 0;
    const child = [0, 15_204, 15_204 + 22_320, 15_204 + 22_320 + 27_840][Math.min(k, 3)] + Math.max(0, k - 3) * 27_840;
    return osvcTax({ income: parseMoney(income) ?? 0, realExpenses: parseMoney(real) ?? 0, expenseRate: mode === "real" ? null : Number(mode), childCredit: child, params: p });
  }, [income, mode, real, kids, p]);
  const num = (k: keyof typeof p) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: Number(e.target.value.replace(/\s/g, "")) || 0 });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <Input label="Příjmy za rok (Kč)" inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} hint="předvyplněno z vydaných faktur za letošek" />
        <Select label="Výdaje" value={mode} onChange={(e) => setMode(e.target.value)}>
          {FLAT_EXPENSES.map((f) => <option key={f.rate} value={f.rate}>Paušál {f.label}</option>)}
          <option value="real">Skutečné výdaje (podle dokladů)</option>
        </Select>
        {mode === "real" && <Input label="Skutečné výdaje za rok (Kč)" inputMode="decimal" value={real} onChange={(e) => setReal(e.target.value)} hint="předvyplněno z přijatých faktur" />}
        <Select label="Počet dětí (daňové zvýhodnění)" value={kids} onChange={(e) => setKids(e.target.value)}>
          {[0, 1, 2, 3, 4].map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
        <details className="rounded-xl bg-black/20 p-3 text-sm">
          <summary className="cursor-pointer text-ink-2">Parametry roku {p.year} (upravitelné)</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Input label="Průměrná mzda" value={String(p.averageWage)} onChange={num("averageWage")} />
            <Input label="Sleva na poplatníka / rok" value={String(p.taxpayerCredit)} onChange={num("taxpayerCredit")} />
            <Input label="Min. záloha sociální / měs." value={String(p.minSocial)} onChange={num("minSocial")} />
            <Input label="Min. záloha zdravotní / měs." value={String(p.minHealth)} onChange={num("minHealth")} />
          </div>
          <p className="mt-2 text-xs text-ink-3">Zdroje se u minimální zálohy na sociální pojištění pro 2026 liší – ověřte aktuální částku na webu ČSSZ.</p>
        </details>
      </div>
      <div className="space-y-1 text-sm" data-testid="tax-result">
        {[
          ["Výdaje uplatněné", r.expenses], ["Zisk (základ)", r.profit],
          ["Daň z příjmů (po slevách)", r.tax], ...(r.childBonus ? [["Daňový bonus na děti (vrátí se)", -r.childBonus] as [string, number]] : []),
          ["Sociální pojištění / rok", r.social], ["Zdravotní pojištění / rok", r.health],
        ].map(([l, v]) => <div key={l as string} className="flex justify-between border-b border-white/[0.06] py-1.5"><span className="text-ink-2">{l}</span><span className="num">{kc(v as number)}</span></div>)}
        <div className="flex justify-between py-2 text-base font-semibold"><span>Odvody celkem</span><span className="num gold-text">{kc(r.total)}</span></div>
        <p className="text-ink-2">To je <b>{(r.effectiveRate * 100).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %</b> z příjmů. Na odvody si odkládejte zhruba <b>{kc(Math.ceil(Math.max(0, r.total) / 12))}</b> měsíčně.</p>
        <p className="text-ink-2">Zálohy na příští rok: sociální asi <b>{kc(r.socialMonthly)}</b>/měs., zdravotní <b>{kc(r.healthMonthly)}</b>/měs.</p>
        <p className="pt-2 text-xs text-ink-3">Orientační výpočet pro hlavní činnost. Nezahrnuje vedlejší činnost, paušální daň, slevu na manžela/ku, odpočty (hypotéka, penzijko, dary) ani 40% limit paušálu u více činností. Nejde o daňové poradenství – před podáním přiznání ověřte na financnisprava.cz nebo u účetní.</p>
        <p className="text-xs text-ink-3">Paušální daň (1. pásmo) se vyplatí hlavně při nižších příjmech a vysokých minimálních zálohách – porovnejte s „Odvody celkem / 12“.</p>
      </div>
    </div>
  );
}
