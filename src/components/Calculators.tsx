"use client";
import { useState } from "react";
import { carCost, futureValue, inflation, monthlyForTarget, monthsToAfford, mortgage, retirementNeed } from "@/lib/calculators";

const fmt = (n: number) => `${Math.round(n).toLocaleString("cs-CZ")} Kč`;
const toNum = (s: string) => Number(s.replace(/\s/g, "").replace(",", ".")) || 0;

function Field({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-ink-2">{label}</span>
      <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 focus-within:border-gold/60">
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 bg-transparent outline-none" aria-label={label} />
        {suffix && <span className="shrink-0 text-xs text-ink-3">{suffix}</span>}
      </span>
    </label>
  );
}
function Out({ rows }: { rows: [string, string, boolean?][] }) {
  return (
    <div className="mt-3 space-y-1 rounded-2xl bg-black/25 p-3 text-sm" role="status">
      {rows.map(([l, v, strong]) => <div key={l} className={`flex justify-between gap-3 ${strong ? "text-base font-semibold" : ""}`}><span className="text-ink-2">{l}</span><span className={`num ${strong ? "gold-text" : ""}`}>{v}</span></div>)}
    </div>
  );
}
function Box({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section id={id} className="glass scroll-mt-20 rounded-3xl p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mb-3 text-sm text-ink-3">{intro}</p>
      {children}
    </section>
  );
}
const use = (init: Record<string, string>) => {
  const [v, set] = useState(init);
  return [v, (k: string) => (x: string) => set((p) => ({ ...p, [k]: x }))] as const;
};

export function MortgageCalc() {
  const [v, on] = use({ p: "4000000", r: "4,9", y: "30" });
  const m = mortgage(toNum(v.p), toNum(v.r), toNum(v.y));
  return (
    <Box id="hypoteka" title="🏠 Hypoteční kalkulačka" intro="Kolik budete měsíčně splácet a kolik zaplatíte bance na úrocích.">
      <div className="grid gap-3 sm:grid-cols-3"><Field label="Výše úvěru" value={v.p} onChange={on("p")} suffix="Kč" /><Field label="Úrok" value={v.r} onChange={on("r")} suffix="% p.a." /><Field label="Doba splácení" value={v.y} onChange={on("y")} suffix="let" /></div>
      <Out rows={[["Měsíční splátka", fmt(m.payment), true], ["Zaplatíte celkem", fmt(m.total)], ["Z toho úroky", fmt(m.interest)]]} />
      <p className="mt-2 text-xs text-ink-3">Banky obvykle chtějí, aby splátky nepřesáhly zhruba 45–50 % čistého příjmu domácnosti (DSTI). Orientační výpočet bez poplatků a pojištění.</p>
    </Box>
  );
}

export function SavingsCalc() {
  const [v, on] = use({ i: "0", m: "3000", r: "5", y: "20", t: "1000000" });
  const fv = futureValue(toNum(v.i), toNum(v.m), toNum(v.r), toNum(v.y));
  const need = monthlyForTarget(toNum(v.t), toNum(v.i), toNum(v.r), toNum(v.y));
  return (
    <Box id="sporeni" title="📈 Spoření a investice" intro="Kolik naspoříte pravidelným vkladem a kolik spořit na cílovou částku.">
      <div className="grid gap-3 sm:grid-cols-4"><Field label="Počáteční vklad" value={v.i} onChange={on("i")} suffix="Kč" /><Field label="Měsíčně" value={v.m} onChange={on("m")} suffix="Kč" /><Field label="Výnos" value={v.r} onChange={on("r")} suffix="% p.a." /><Field label="Doba" value={v.y} onChange={on("y")} suffix="let" /></div>
      <Out rows={[["Naspoříte", fmt(fv.value), true], ["Vložíte", fmt(fv.deposited)], ["Výnos navíc", fmt(fv.gain)]]} />
      <div className="mt-3 max-w-xs"><Field label="Chci mít" value={v.t} onChange={on("t")} suffix="Kč" /></div>
      <Out rows={[["Měsíčně je potřeba", fmt(need), true]]} />
      <p className="mt-2 text-xs text-ink-3">Výnos není zaručený. Akciové ETF historicky ~5–7 % ročně dlouhodobě, spořicí účty ~2–4 %. Nejde o investiční doporučení.</p>
    </Box>
  );
}

export function RetirementCalc() {
  const [v, on] = use({ inc: "15000", yrs: "20", r: "3", now: "35", ret: "65", have: "100000", ry: "6" });
  const need = retirementNeed(toNum(v.inc), toNum(v.yrs), toNum(v.r));
  const years = Math.max(1, toNum(v.ret) - toNum(v.now));
  const monthly = monthlyForTarget(need, toNum(v.have), toNum(v.ry), years);
  return (
    <Box id="duchod" title="👵 Renta k důchodu" intro="Kolik potřebujete mít naspořeno, abyste si k důchodu přilepšili, a kolik na to spořit.">
      <div className="grid gap-3 sm:grid-cols-3"><Field label="Přilepšení měsíčně" value={v.inc} onChange={on("inc")} suffix="Kč" /><Field label="Po dobu" value={v.yrs} onChange={on("yrs")} suffix="let" /><Field label="Výnos v důchodu" value={v.r} onChange={on("r")} suffix="% p.a." /></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4"><Field label="Váš věk" value={v.now} onChange={on("now")} /><Field label="Důchod od" value={v.ret} onChange={on("ret")} /><Field label="Už mám" value={v.have} onChange={on("have")} suffix="Kč" /><Field label="Výnos do důchodu" value={v.ry} onChange={on("ry")} suffix="% p.a." /></div>
      <Out rows={[["Potřebujete naspořit", fmt(need)], ["Spořte měsíčně", fmt(monthly), true]]} />
      <p className="mt-2 text-xs text-ink-3">Nepočítá s inflací – pro reálnou hodnotu snižte výnosy o ~2–3 %. Využijte státní příspěvek a daňový odpočet u penzijka (DIP / doplňkové penzijní spoření).</p>
    </Box>
  );
}

export function AffordCalc() {
  const [v, on] = use({ p: "35000", h: "8000", m: "4000" });
  const m = monthsToAfford(toNum(v.p), toNum(v.h), toNum(v.m));
  return (
    <Box id="dovolit" title="🛍️ Kdy si to můžu dovolit?" intro="Za jak dlouho našetříte na novou věc, když budete odkládat pravidelně.">
      <div className="grid gap-3 sm:grid-cols-3"><Field label="Cena" value={v.p} onChange={on("p")} suffix="Kč" /><Field label="Už mám" value={v.h} onChange={on("h")} suffix="Kč" /><Field label="Odložím měsíčně" value={v.m} onChange={on("m")} suffix="Kč" /></div>
      <Out rows={[["Doba", m === null ? "nikdy – zvyšte měsíční částku" : m === 0 ? "už teď 🎉" : `${m} měs.`, true], ...(m ? [["Na nákup", new Date(new Date().getFullYear(), new Date().getMonth() + m, 1).toLocaleDateString("cs-CZ", { month: "long", year: "numeric" })] as [string, string]] : [])]} />
    </Box>
  );
}

export function CarCalc() {
  const [v, on] = use({ price: "450000", years: "6", resale: "35", km: "15000", cons: "6,5", fuel: "37", ins: "9000", serv: "7000", other: "3000" });
  const c = carCost({ price: toNum(v.price), years: toNum(v.years), resalePct: toNum(v.resale), kmPerYear: toNum(v.km), consumption: toNum(v.cons), fuelPrice: toNum(v.fuel), insurance: toNum(v.ins), service: toNum(v.serv), other: toNum(v.other) });
  return (
    <Box id="auto" title="🚗 Kolik mě stojí auto" intro="Skutečné náklady včetně ztráty hodnoty – často dvojnásobek toho, co dáte za benzín.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Pořizovací cena" value={v.price} onChange={on("price")} suffix="Kč" /><Field label="Budu ho mít" value={v.years} onChange={on("years")} suffix="let" /><Field label="Pak prodám za" value={v.resale} onChange={on("resale")} suffix="% ceny" />
        <Field label="Najezdím ročně" value={v.km} onChange={on("km")} suffix="km" /><Field label="Spotřeba" value={v.cons} onChange={on("cons")} suffix="l/100 km" /><Field label="Cena paliva" value={v.fuel} onChange={on("fuel")} suffix="Kč/l" />
        <Field label="Pojištění ročně" value={v.ins} onChange={on("ins")} suffix="Kč" /><Field label="Servis a pneu ročně" value={v.serv} onChange={on("serv")} suffix="Kč" /><Field label="Ostatní (dálnice, parkování)" value={v.other} onChange={on("other")} suffix="Kč" />
      </div>
      <Out rows={[["Ročně celkem", fmt(c.yearly), true], ["Měsíčně", fmt(c.monthly)], ["Na 1 km", `${c.perKm.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} Kč`], ["Z toho ztráta hodnoty / rok", fmt(c.depreciation)], ["Palivo / rok", fmt(c.fuel)]]} />
    </Box>
  );
}

export function InflationCalc() {
  const [v, on] = use({ a: "100000", r: "3", y: "10" });
  const r = inflation(toNum(v.a), toNum(v.r), toNum(v.y));
  return (
    <Box id="inflace" title="💸 Inflace" intro="Kolik budou dnešní peníze za pár let skutečně stát.">
      <div className="grid gap-3 sm:grid-cols-3"><Field label="Částka dnes" value={v.a} onChange={on("a")} suffix="Kč" /><Field label="Inflace" value={v.r} onChange={on("r")} suffix="% ročně" /><Field label="Za" value={v.y} onChange={on("y")} suffix="let" /></div>
      <Out rows={[["Kupní síla za tu dobu", fmt(r.realValue), true], ["Na stejný nákup budete potřebovat", fmt(r.neededAmount)]]} />
    </Box>
  );
}

export function AllCalculators() {
  return (
    <div className="space-y-4">
      <MortgageCalc /><SavingsCalc /><AffordCalc /><CarCalc /><RetirementCalc /><InflationCalc />
    </div>
  );
}
