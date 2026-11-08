"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Briefcase, Plane, PiggyBank, Plus, Receipt, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { InvoiceForm } from "@/components/forms/InvoiceForms";
import { PurchaseForm } from "@/components/forms/PurchaseForms";
import { ShiftForm } from "@/components/forms/WorkForms";
import { ContributionForm } from "@/components/forms/SavingsForms";
import { cn } from "@/components/ui/cn";
import { useLookups } from "@/components/Lookups";
import Link from "next/link";
import { ExpenseForm } from "@/components/travel/TripForms";

function NeedIco({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-3 text-sm text-ink-2">
      <p>Faktury a pracovní směny jsou pro podnikání na IČO. Nejdřív aktivujte IČO v Nastavení.</p>
      <Link href="/nastaveni#ico" onClick={onClose} className="inline-flex h-10 items-center rounded-full bg-gold px-4 font-medium text-[#1b1407]">Aktivovat IČO</Link>
    </div>
  );
}

function TripExpenseQuick({ onDone }: { onDone: () => void }) {
  const { activeTrips = [] } = useLookups();
  const [id, setId] = useState(activeTrips[0]?.trip.id ?? "");
  const t = activeTrips.find((x) => x.trip.id === id) ?? activeTrips[0];
  if (!t) return null;
  return (
    <div className="space-y-4">
      {activeTrips.length > 1 && (
        <select className="field" aria-label="Cesta" value={id} onChange={(e) => setId(e.target.value)}>
          {activeTrips.map((x) => <option key={x.trip.id} value={x.trip.id}>{x.trip.name}</option>)}
        </select>
      )}
      <ExpenseForm key={t.trip.id} trip={t.trip} onDone={onDone} people={t.people} wallets={t.wallets} />
    </div>
  );
}

const ITEMS = [
  { key: "trip", label: "Výdaj na cestě", icon: Plane },
  { key: "income", label: "Přidat příjem", icon: ArrowDownLeft },
  { key: "expense", label: "Přidat výdaj", icon: ArrowUpRight },
  { key: "invoice", label: "Přidat fakturu", icon: Receipt },
  { key: "purchase", label: "Přidat nákup", icon: ShoppingBag },
  { key: "shift", label: "Přidat pracovní směnu", icon: Briefcase },
  { key: "saving", label: "Přidat spoření", icon: PiggyBank },
] as const;

type Key = (typeof ITEMS)[number]["key"];
const TITLES: Record<Key, string> = {
  trip: "Výdaj na cestě", income: "Nový příjem", expense: "Nový výdaj", invoice: "Nová faktura", purchase: "Nový nákup", shift: "Nová směna", saving: "Vklad na spoření" };

/** Rychlé tlačítko + (na mobilu plovoucí, na desktopu v horní liště). */
export function QuickAdd({ floating }: { floating?: boolean }) {
  const [menu, setMenu] = useState(false);
  const [form, setForm] = useState<Key | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setForm(null), []);
  const { icoActive, activeTrips = [] } = useLookups();
  useEffect(() => {
    if (!menu) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menu]);
  return (
    <div ref={ref} className={cn("relative", floating && "fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 lg:hidden")}>
      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        aria-expanded={menu}
        aria-label="Rychle přidat"
        className={cn(
          "flex items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold text-[#1b1407] shadow-[0_10px_30px_-8px_rgb(var(--accent-rgb)/0.7)] transition active:scale-95",
          floating ? "h-14 w-14" : "h-10 gap-2 px-4 text-sm font-semibold",
        )}
      >
        <Plus className={cn("transition-transform", menu && "rotate-45", floating ? "h-6 w-6" : "h-4 w-4")} />
        {!floating && "Přidat"}
      </button>
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, y: floating ? 8 : -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: floating ? 8 : -8, scale: 0.96 }}
            className={cn("glass-strong absolute z-50 w-64 rounded-2xl p-1.5", floating ? "bottom-16 right-0" : "right-0 top-12")}
            role="menu"
          >
            {ITEMS.filter((i) => i.key !== "trip" || activeTrips.length > 0).map((i) => (
              <button key={i.key} role="menuitem" type="button" onClick={() => { setMenu(false); setForm(i.key); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/[0.07]">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-gold"><i.icon className="h-4 w-4" /></span>
                {i.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <Modal open={form != null} onClose={close} title={form ? TITLES[form] : ""}>
        {form === "trip" && <TripExpenseQuick onDone={close} />}
        {form === "income" && <TransactionForm defaultType="income" onDone={close} />}
        {form === "expense" && <TransactionForm defaultType="expense" onDone={close} />}
        {form === "invoice" && (icoActive ? <InvoiceForm onDone={close} /> : <NeedIco onClose={close} />)}
        {form === "purchase" && <PurchaseForm onDone={close} />}
        {form === "shift" && (icoActive ? <ShiftForm onDone={close} /> : <NeedIco onClose={close} />)}
        {form === "saving" && <ContributionForm onDone={close} />}
      </Modal>
    </div>
  );
}
