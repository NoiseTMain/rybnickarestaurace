"use client";
import { ArrowUp, Bot, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { askAssistant } from "@/lib/actions/assistant";
import type { AssistantAnswer } from "@/lib/assistant";
import { cn } from "@/components/ui/cn";

const SUGGESTIONS = [
  "Můžeme si dovolit koupit sedačku za 15 000 Kč?",
  "Kolik můžeme utratit tento týden?",
  "Kolik nám zbývá na jídlo?",
  "Kolik nám zbude na konci měsíce?",
  "Máme faktury po splatnosti?",
  "Kolik musíme odkládat na cíle?",
];

type Msg = { role: "user"; text: string } | { role: "bot"; a: AssistantAnswer };

export function AssistantChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
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
      const a = await askAssistant(text);
      setMsgs((m) => [...m, { role: "bot", a }]);
    });
  };
  return (
    <div className="flex min-h-[26rem] flex-col">
      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto pb-3" aria-live="polite">
        {!msgs.length && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-left text-sm text-ink-2 hover:border-gold/40 hover:text-ink">{s}</button>)}
          </div>
        )}
        {msgs.map((m, i) => m.role === "user" ? (
          <div key={i} className="flex justify-end gap-2"><p className="max-w-[85%] rounded-2xl rounded-br-md bg-gold/90 px-3.5 py-2 text-sm text-[#1b1407]">{m.text}</p><User className="mt-1 h-4 w-4 shrink-0 text-ink-3" /></div>
        ) : (
          <div key={i} className="flex gap-2">
            <Bot className="mt-1 h-4 w-4 shrink-0 text-gold" />
            <div className={cn("max-w-[90%] rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-sm", m.a.tone === "positive" ? "border-pos/25 bg-pos/[0.07]" : m.a.tone === "danger" ? "border-neg/25 bg-neg/[0.07]" : m.a.tone === "warning" ? "border-warn/25 bg-warn/[0.07]" : "border-white/10 bg-white/[0.04]")}>
              <p>{m.a.text}</p>
              {m.a.lines && <ul className="mt-2 space-y-0.5 text-xs text-ink-2">{m.a.lines.map((l, j) => <li key={j}>• {l}</li>)}</ul>}
              {m.a.needs?.href && <Link href={m.a.needs.href} className="mt-2 inline-block text-xs text-gold underline">{m.a.needs.message}</Link>}
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
    </div>
  );
}
