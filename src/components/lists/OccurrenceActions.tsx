"use client";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { markOccurrence } from "@/lib/actions/payments";
import { ActionButton } from "@/components/ui/ActionButton";

/** Další možnosti termínu: zaplaceno mimo evidenci / přeskočit / zrušit označení. */
export function OccurrenceMenu({ kind, refId, date, marked }: { kind: "recurring" | "income"; refId: string; date: string; marked: boolean }) {
  const [open, setOpen] = useState(false);
  if (marked) return <ActionButton action={() => markOccurrence(kind, refId, date, null)} size="sm">Zrušit označení</ActionButton>;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-full p-2 text-ink-3 hover:bg-white/10 hover:text-ink" aria-label="Další možnosti" aria-expanded={open}><MoreHorizontal className="h-4 w-4" /></button>
      {open && (
        <div className="glass-strong absolute right-0 top-9 z-20 w-60 rounded-xl p-1" onMouseLeave={() => setOpen(false)}>
          <ActionButton action={() => markOccurrence(kind, refId, date, "paid_untracked")} className="w-full justify-start" onDone={() => setOpen(false)}>
            {kind === "recurring" ? "Zaplaceno mimo sledované účty" : "Přijato mimo sledované účty"}
          </ActionButton>
          <ActionButton action={() => markOccurrence(kind, refId, date, "skipped")} className="w-full justify-start" onDone={() => setOpen(false)}>Tento termín přeskočit</ActionButton>
        </div>
      )}
    </div>
  );
}
