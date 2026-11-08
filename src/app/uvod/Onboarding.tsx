"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, FlaskConical, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { acceptInvite, completeOnboarding, createDemoHousehold } from "@/lib/actions/household";
import { initialResult } from "@/lib/actions/result";
import { parseMoney, formatMoney } from "@/lib/money";
import { FREQUENCY_LABEL } from "@/lib/finance/recurrence";
import { Button } from "@/components/ui/Button";
import { FormError, Input, MoneyInput, Select } from "@/components/ui/Field";
import { PROFILES, SECTIONS } from "@/lib/profiles";
import { FREE_LIMITS } from "@/lib/plans";
import type { LifeProfile } from "@/lib/db/types";
import { cn } from "@/components/ui/cn";

type Freq = "weekly" | "monthly" | "quarterly" | "yearly" | "once";
interface State {
  householdName: string;
  members: { name: string }[];
  accounts: { name: string; kind: "checking" | "cash" | "savings"; balance: string; date: string }[];
  incomes: { name: string; amount: string; frequency: Freq; date: string; member: number }[];
  recurring: { name: string; amount: string; frequency: Freq; date: string; category: string }[];
  foodBudget: string;
  safetyBuffer: string;
  billingIco: string;
  profile: LifeProfile | null;
}

const STEPS = ["Domácnost", "Účty", "Příjmy", "Výdaje", "Rozpočet", "Shrnutí"];
const EXPENSE_CATEGORIES = ["Nájem", "Elektřina", "Voda", "Plyn", "Internet", "Telefony", "Pojištění", "Auto", "Doprava", "Zábava", "Domácí potřeby", "Ostatní"];

export function Onboarding({ today, email, hasHousehold, hasAny }: { today: string; email: string; hasHousehold: boolean; hasAny: boolean }) {
  const [step, setStep] = useState(-1);
  const [s, setS] = useState<State>({
    householdName: "Naše domácnost",
    members: [{ name: "" }],
    accounts: [{ name: "Běžný účet", kind: "checking", balance: "", date: today }],
    incomes: [],
    recurring: ["Nájem", "Elektřina", "Internet", "Telefony"].map((n) => ({ name: n, amount: "", frequency: "monthly" as Freq, date: today, category: n })),
    foodBudget: "",
    safetyBuffer: "",
    billingIco: "",
    profile: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [demoPending, startDemo] = useTransition();
  const [inviteState, inviteAction, invitePending] = useActionState(acceptInvite, initialResult);

  const upd = <K extends keyof State>(k: K, v: State[K]) => setS((x) => ({ ...x, [k]: v }));
  const list = <K extends "members" | "accounts" | "incomes" | "recurring">(k: K, i: number, patch: Partial<State[K][number]>) =>
    setS((x) => ({ ...x, [k]: (x[k] as State[K][number][]).map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const remove = (k: "members" | "accounts" | "incomes" | "recurring", i: number) => setS((x) => ({ ...x, [k]: (x[k] as unknown[]).filter((_, j) => j !== i) }));

  function validateStep(): string | null {
    if (step === 0) {
      if (!s.householdName.trim()) return "Zadejte název domácnosti.";
      if (!s.members.some((m) => m.name.trim())) return "Zadejte alespoň jednoho člena.";
    }
    if (step === 1) {
      for (const a of s.accounts) {
        if (!a.name.trim()) return "Každý účet musí mít název.";
        if (parseMoney(a.balance) == null) return `Zadejte aktuální zůstatek účtu „${a.name}“ (i 0).`;
      }
    }
    if (step === 2) for (const i of s.incomes) if (!i.name.trim() || !(parseMoney(i.amount)! > 0)) return "U každého příjmu vyplňte název a částku, nebo ho odeberte.";
    if (step === 4) {
      if (s.foodBudget && parseMoney(s.foodBudget) == null) return "Neplatný rozpočet na jídlo.";
      if (s.safetyBuffer && parseMoney(s.safetyBuffer) == null) return "Neplatná rezerva.";
      if (s.billingIco && !/^\d{8}$/.test(s.billingIco.replace(/\s/g, ""))) return "IČO má 8 číslic.";
    }
    return null;
  }

  function next() {
    const e = validateStep();
    setError(e);
    if (!e) setStep((x) => x + 1);
  }

  function finish() {
    const payload = {
      householdName: s.householdName,
      members: s.members.filter((m) => m.name.trim()),
      accounts: s.accounts,
      incomes: s.incomes,
      recurring: s.recurring.filter((r) => r.amount.trim() !== ""),
      foodBudget: s.foodBudget,
      safetyBuffer: s.safetyBuffer,
      billingIco: s.billingIco,
      profile: s.profile,
    };
    start(async () => {
      const r = await completeOnboarding(JSON.stringify(payload));
      if (r && !r.ok) setError(r.error + (r.fieldErrors ? " " + Object.values(r.fieldErrors).join(", ") : ""));
    });
  }

  if (step === -1) {
    return (
      <Frame>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">Vítejte v Home<span className="gold-text">OS</span></h1>
        <p className="mt-2 text-ink-2">Přihlášen(a) jako {email}. Za pár minut nastavíme vaši finanční centrálu. Všechny údaje zadáváte vy – aplikace si nic nevymýšlí a vše lze později změnit.</p>
        <div className="mt-6 grid gap-3">
          <button onClick={() => setStep(0)} className="glass-light group flex items-center gap-4 rounded-2xl p-4 text-left">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold text-[#1b1407]"><Check className="h-5 w-5" /></span>
            <span className="flex-1"><b className="block">Nastavit moji domácnost</b><span className="text-sm text-ink-2">Členové, účty a zůstatky, příjmy, pravidelné platby, rozpočet</span></span>
            <ArrowRight className="h-5 w-5 text-ink-2 transition group-hover:translate-x-1" />
          </button>
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-3"><Users className="h-5 w-5 text-gold" /><b>Připojit se k existující domácnosti</b></div>
            <form action={inviteAction} className="mt-3 flex gap-2">
              <input name="code" placeholder="Kód pozvánky" className="field flex-1 uppercase" aria-label="Kód pozvánky" />
              <Button type="submit" loading={invitePending}>Připojit</Button>
            </form>
            <FormError error={inviteState.ok ? undefined : inviteState.error} />
          </div>
          <button disabled={demoPending} onClick={() => startDemo(async () => { const r = await createDemoHousehold(); if (r && !r.ok) setError(r.error ?? "Chyba"); })} className="glass flex items-center gap-4 rounded-2xl p-4 text-left">
            <FlaskConical className="h-5 w-5 text-warn" />
            <span className="flex-1"><b className="block">{demoPending ? "Připravuji ukázku…" : "Vyzkoušet s ukázkovými daty"}</b><span className="text-sm text-ink-2">Samostatná DEMO domácnost, oddělená od vašich skutečných financí</span></span>
          </button>
          {hasAny && <Link href="/" className="text-center text-sm text-gold hover:underline">{hasHousehold ? "Pokračovat do aplikace" : "Zpět do demo domácnosti"}</Link>}
          <FormError error={error ?? undefined} />
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <ol className="mb-6 flex gap-1.5" aria-label="Kroky">
        {STEPS.map((t, i) => <li key={t} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-gold" : "bg-white/10")} title={t} />)}
      </ol>
      <p className="text-xs uppercase tracking-wider text-ink-3">Krok {step + 1} z {STEPS.length}</p>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="mt-1 space-y-4">
          {step === 0 && (
            <>
              <H title="Vaše situace a domácnost" text="Podle situace vám přizpůsobíme sekce a tipy (vše jde později změnit v Nastavení)." />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Vaše situace">
                {PROFILES.map((p) => (
                  <button key={p.key} type="button" role="radio" aria-checked={s.profile === p.key} onClick={() => upd("profile", s.profile === p.key ? null : p.key)}
                    className={cn("rounded-2xl border p-3 text-left text-sm transition", s.profile === p.key ? "border-gold bg-gold/15" : "border-white/10 hover:bg-white/[0.04]")}>
                    <span className="text-xl">{p.emoji}</span>
                    <span className="mt-1 block font-medium">{p.label}</span>
                  </button>
                ))}
              </div>
              {s.profile && <p className="text-xs text-ink-3">{PROFILES.find((p) => p.key === s.profile)?.detail}{(PROFILES.find((p) => p.key === s.profile)?.hide.length ?? 0) > 0 ? ` Skryjeme: ${PROFILES.find((p) => p.key === s.profile)!.hide.map((h) => SECTIONS.find((x) => x.key === h)?.label).join(", ")}.` : ""}</p>}
              <Input label="Název domácnosti" value={s.householdName} onChange={(e) => upd("householdName", e.target.value)} />
              {s.members.map((m, i) => (
                <Row key={i} onRemove={s.members.length > 1 ? () => remove("members", i) : undefined}>
                  <Input label={i === 0 ? "Vaše jméno" : `Člen ${i + 1}`} value={m.name} onChange={(e) => list("members", i, { name: e.target.value })} className="flex-1" />
                </Row>
              ))}
              {s.members.length < FREE_LIMITS.members ? <AddButton onClick={() => upd("members", [...s.members, { name: "" }])}>Přidat člena</AddButton> : <p className="text-xs text-ink-3">Ve verzi zdarma můžete mít {FREE_LIMITS.members} členy. Další přidáte s Premium.</p>}
            </>
          )}
          {step === 1 && (
            <>
              <H title="Účty a hotovost" text="Zadejte AKTUÁLNÍ zůstatky k dnešnímu datu (nebo k datu, od kterého chcete evidovat). Spořicí účty se do volných peněz nepočítají." />
              {s.accounts.map((a, i) => (
                <div key={i} className="rounded-2xl border border-white/10 p-3">
                  <Row onRemove={() => remove("accounts", i)}>
                    <Input label="Název" value={a.name} onChange={(e) => list("accounts", i, { name: e.target.value })} className="flex-1" />
                    <Select label="Typ" value={a.kind} onChange={(e) => list("accounts", i, { kind: e.target.value as State["accounts"][number]["kind"] })} className="w-36">
                      <option value="checking">Běžný účet</option><option value="cash">Hotovost</option><option value="savings">Spořicí</option>
                    </Select>
                  </Row>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <MoneyInput label="Zůstatek" value={a.balance} onChange={(e) => list("accounts", i, { balance: e.target.value })} />
                    <Input type="date" label="K datu" value={a.date} onChange={(e) => list("accounts", i, { date: e.target.value })} />
                  </div>
                </div>
              ))}
              <AddButton onClick={() => upd("accounts", [...s.accounts, { name: "", kind: "cash", balance: "", date: today }])}>Přidat účet / hotovost</AddButton>
            </>
          )}
          {step === 2 && (
            <>
              <H title="Pravidelné příjmy" text="Mzda, výplaty, příspěvky… Jsou to OČEKÁVANÉ příjmy – do dostupných peněz se započtou až po přijetí. Výplaty z práce na směny (brigády, kurýr…) můžete evidovat podrobně v sekci Práce." />
              {s.incomes.map((inc, i) => (
                <div key={i} className="rounded-2xl border border-white/10 p-3">
                  <Row onRemove={() => remove("incomes", i)}><Input label="Název" value={inc.name} onChange={(e) => list("incomes", i, { name: e.target.value })} className="flex-1" /></Row>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <MoneyInput label="Částka" value={inc.amount} onChange={(e) => list("incomes", i, { amount: e.target.value })} />
                    <Select label="Frekvence" value={inc.frequency} onChange={(e) => list("incomes", i, { frequency: e.target.value as Freq })}>
                      {Object.entries(FREQUENCY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                    <Input type="date" label="Nejbližší výplata" value={inc.date} onChange={(e) => list("incomes", i, { date: e.target.value })} />
                    <Select label="Kdo" value={String(inc.member)} onChange={(e) => list("incomes", i, { member: Number(e.target.value) })}>
                      {s.members.filter((m) => m.name.trim()).map((m, j) => <option key={j} value={j}>{m.name}</option>)}
                    </Select>
                  </div>
                </div>
              ))}
              <AddButton onClick={() => upd("incomes", [...s.incomes, { name: "", amount: "", frequency: "monthly", date: today, member: 0 }])}>Přidat příjem</AddButton>
              {s.incomes.length === 0 && <p className="text-sm text-ink-3">Můžete přeskočit a doplnit později.</p>}
            </>
          )}
          {step === 3 && (
            <>
              <H title="Pravidelné výdaje" text="Vyplňte částky plateb, které opravdu máte. Řádky bez částky se neuloží. Datum = nejbližší splatnost." />
              {s.recurring.map((r, i) => (
                <div key={i} className="rounded-2xl border border-white/10 p-3">
                  <Row onRemove={() => remove("recurring", i)}>
                    <Input label="Název" value={r.name} onChange={(e) => list("recurring", i, { name: e.target.value })} className="flex-1" />
                    <Select label="Kategorie" value={r.category} onChange={(e) => list("recurring", i, { category: e.target.value })} className="w-36">
                      {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </Row>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <MoneyInput label="Částka" value={r.amount} onChange={(e) => list("recurring", i, { amount: e.target.value })} />
                    <Select label="Frekvence" value={r.frequency} onChange={(e) => list("recurring", i, { frequency: e.target.value as Freq })}>
                      {Object.entries(FREQUENCY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                    <Input type="date" label="Splatnost" value={r.date} onChange={(e) => list("recurring", i, { date: e.target.value })} />
                  </div>
                </div>
              ))}
              <AddButton onClick={() => upd("recurring", [...s.recurring, { name: "", amount: "", frequency: "monthly", date: today, category: "Ostatní" }])}>Přidat platbu</AddButton>
            </>
          )}
          {step === 4 && (
            <>
              <H title="Rozpočet a rezerva" text="Rozpočet na jídlo aplikace rozpočítá na týdny a dny. Rezerva je částka, která má na účtu vždy zůstat." />
              <MoneyInput label="Měsíční rozpočet na jídlo" hint="nepovinné" value={s.foodBudget} onChange={(e) => upd("foodBudget", e.target.value)} />
              <MoneyInput label="Bezpečnostní rezerva na nečekané výdaje" hint="nepovinné" value={s.safetyBuffer} onChange={(e) => upd("safetyBuffer", e.target.value)} />
              <Input label="Vaše IČO" hint="pro faktury a OCR, nepovinné" inputMode="numeric" value={s.billingIco} onChange={(e) => upd("billingIco", e.target.value)} />
            </>
          )}
          {step === 5 && (
            <>
              <H title="Shrnutí" text="Zkontrolujte údaje. Vše lze později upravit v Nastavení." />
              <ul className="space-y-2 text-sm">
                <Sum k="Domácnost" v={`${s.householdName} · ${s.members.filter((m) => m.name.trim()).map((m) => m.name).join(", ")}`} />
                {s.accounts.map((a, i) => <Sum key={i} k={a.name} v={formatMoney(parseMoney(a.balance) ?? 0)} />)}
                <Sum k="Pravidelné příjmy" v={s.incomes.length ? s.incomes.map((i) => `${i.name} ${formatMoney(parseMoney(i.amount) ?? 0)}`).join(", ") : "žádné"} />
                <Sum k="Pravidelné platby" v={s.recurring.filter((r) => r.amount).map((r) => `${r.name} ${formatMoney(parseMoney(r.amount) ?? 0)}`).join(", ") || "žádné"} />
                <Sum k="Rozpočet na jídlo" v={s.foodBudget ? formatMoney(parseMoney(s.foodBudget) ?? 0) : "nenastaven"} />
                <Sum k="Rezerva" v={s.safetyBuffer ? formatMoney(parseMoney(s.safetyBuffer) ?? 0) : "0 Kč"} />
              </ul>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <FormError error={error ?? undefined} />
      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => { setError(null); setStep((x) => x - 1); }}>Zpět</Button>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" onClick={next}>Pokračovat <ArrowRight className="h-4 w-4" /></Button>
        ) : (
          <Button variant="primary" loading={pending} onClick={finish} icon={<Check className="h-4 w-4" />}>Dokončit nastavení</Button>
        )}
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-xl items-center px-4 py-10"><div className="glass w-full rounded-[28px] p-6 sm:p-8">{children}</div></main>;
}
function H({ title, text }: { title: string; text: string }) {
  return <div><h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">{title}</h2><p className="mt-1 text-sm text-ink-2">{text}</p></div>;
}
function Row({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return <div className="flex items-end gap-2">{children}{onRemove && <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Odebrat"><Trash2 className="h-4 w-4" /></Button>}</div>;
}
function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={onClick}>{children}</Button>;
}
function Sum({ k, v }: { k: string; v: string }) {
  return <li className="flex justify-between gap-4 border-b border-white/[0.06] pb-2"><span className="text-ink-3">{k}</span><span className="text-right">{v}</span></li>;
}
