"use client";
import { ArrowUp, Bot, Check, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { askAssistant } from "@/lib/actions/assistant";
import { saveTransaction } from "@/lib/actions/transactions";
import { initialResult } from "@/lib/actions/result";
import type { AssistantAnswer, AssistantContext, ExpenseDraft } from "@/lib/assistant";
import { formatMoney, toInputValue } from "@/lib/money";
import { useLookups } from "@/components/Lookups";
import { Button } from "@/components/ui/Button";
import { MoneyInput, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { AccountOptions, CategoryOptions } from "@/components/forms/common";
import { cn } from "@/components/ui/cn";

const SUGGESTIONS = [
  "Můžeme si dovolit koupit sedačku za 15 000 Kč?",
  "Kolik jsme za poslední 3 měsíce utratili v restauracích?",
  "Co když koupíme sedačku za 15 000 Kč na 10 splátek?",
  "Jak jsme na tom za poslední 3 měsíce?",
  "Je v našich výdajích něco neobvyklého?",
  "Kde můžeme ušetřit?",
  "Kolik nám zbývá na jídlo?",
  "250 Albert",
];

type Msg = { role: "user"; text: string } | { role: "bot"; a: AssistantAnswer };

/** Potvrzení výdaje navrženého asistentem – nic se neuloží bez kliknutí. */
function DraftCard({ draft, onSaved }: { draft: ExpenseDraft; onSaved: (text: string) => void }) {
  const lk = useLookups();
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  if (saved) return <p className="mt-2 flex items-center gap-1.5 text-xs text-pos"><Check className="h-3.5 w-3.5" />Zapsáno</p>;
  if (!lk.accounts.length) return <p className="mt-2 text-xs text-warn">Nejdřív přidejte účet v Nastavení.</p>;
  return (
    <form ref={ref} className="mt-3 space-y-2" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(ref.current!);
      start(async () => {
        const r = await saveTransaction(initialResult, fd);
        if (r.ok) { setSaved(true); toast(r.message ?? "Uloženo"); onSaved(`Zapsáno: ${draft.description} ${formatMoney(draft.amount)}`); }
        else toast(r.error ?? "Nepovedlo se", "error");
      });
    }}>
      <input type="hidden" name="type" value="expense" />
      <input type="hidden" name="date" value={draft.date} />
      <input type="hidden" name="payment_method" value={draft.paymentMethod} />
      <input type="hidden" name="scope" value="shared" />
      <input type="hidden" name="description" value={draft.description} />
      <div className="grid grid-cols-2 gap-2">
        <MoneyInput name="amount" label="Částka" defaultValue={toInputValue(draft.amount)} />
        <Select name="category_id" label="Kategorie" defaultValue={draft.categoryId ?? ""}><CategoryOptions kind="expense" /></Select>
      </div>
      <Select name="account_id" label="Z účtu" defaultValue={lk.accounts.find((a) => a.include_in_available)?.id}><AccountOptions /></Select>
      <Button type="submit" variant="primary" size="sm" loading={pending} icon={<Check className="h-4 w-4" />}>Zapsat výdaj</Button>
    </form>
  );
}

export function AssistantChat({ aiEnabled }: { aiEnabled: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [context, setContext] = useState<AssistantContext | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs]);
  const ask = (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setQ("");
    start(async () => {
      const a = await askAssistant(text, context);
      if (a.context && a.context.intent !== "unknown") setContext(a.context);
      setMsgs((m) => [...m, { role: "bot", a }]);
    });
  };
  return (
    <div className="flex min-h-[26rem] flex-col">
      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto pb-3" aria-live="polite">
        {!msgs.length && (
          <>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-left text-sm text-ink-2 hover:border-gold/40 hover:text-ink">{s}</button>)}
            </div>
            <p className="text-xs text-ink-3">Můžete navazovat („A za 20 000?“, „A minulý měsíc?“) nebo rovnou zapsat výdaj („250 Albert“, „tankování 1 400 kartou“).</p>
          </>
        )}
        {msgs.map((m, i) => m.role === "user" ? (
          <div key={i} className="flex justify-end gap-2"><p className="max-w-[85%] rounded-2xl rounded-br-md bg-gold/90 px-3.5 py-2 text-sm text-[#1b1407]">{m.text}</p><User className="mt-1 h-4 w-4 shrink-0 text-ink-3" /></div>
        ) : (
          <div key={i} className="flex gap-2">
            <Bot className="mt-1 h-4 w-4 shrink-0 text-gold" />
            <div className={cn("min-w-0 max-w-[92%] rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-sm", m.a.tone === "positive" ? "border-pos/25 bg-pos/[0.07]" : m.a.tone === "danger" ? "border-neg/25 bg-neg/[0.07]" : m.a.tone === "warning" ? "border-warn/25 bg-warn/[0.07]" : "border-white/10 bg-white/[0.04]")}>
              <p>{m.a.text}</p>
              {m.a.table && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-xs">
                    <thead className="text-ink-3"><tr>{m.a.table.head.map((h) => <th key={h} className="py-1 pr-3 text-left font-medium">{h}</th>)}</tr></thead>
                    <tbody>{m.a.table.rows.map((r, j) => <tr key={j} className="border-t border-white/[0.06]">{r.map((c, k) => <td key={k} className={cn("num py-1 pr-3", k > 0 && "text-right", k === r.length - 1 && c.startsWith("−") && "text-neg")}>{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              {m.a.lines && <ul className="mt-2 space-y-0.5 text-xs text-ink-2">{m.a.lines.map((l, j) => <li key={j}>• {l}</li>)}</ul>}
              {m.a.draft && <DraftCard draft={m.a.draft} onSaved={(t) => setMsgs((x) => [...x, { role: "bot", a: { text: t, tone: "positive" } }])} />}
              {m.a.needs?.href && <Link href={m.a.needs.href} className="mt-2 inline-block text-xs text-gold underline">{m.a.needs.message}</Link>}
              {m.a.viaAi && <p className="mt-2 flex items-center gap-1 text-[10px] text-info"><Sparkles className="h-3 w-3" />Otázku pomohla pochopit AI, čísla spočítala aplikace z vašich dat.</p>}
            </div>
          </div>
        ))}
        {pending && <p className="pl-6 text-sm text-ink-3">Počítám…</p>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2 border-t border-white/[0.06] pt-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Např. Můžeme si dovolit pračku za 9 990 Kč?" className="field flex-1" aria-label="Otázka pro asistenta" maxLength={500} />
        <button type="submit" disabled={pending || !q.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-[#1b1407] disabled:opacity-40" aria-label="Odeslat"><ArrowUp className="h-5 w-5" /></button>
      </form>
      <p className="mt-2 text-[11px] text-ink-3">{aiEnabled ? "AI porozumění volnému textu je zapnuté – čísla vždy počítá aplikace." : "Odpovědi počítá aplikace z vašich dat (AI pro volný text není zapnutá)."}</p>
    </div>
  );
}
