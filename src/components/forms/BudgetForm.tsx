"use client";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { saveBudget } from "@/lib/actions/budgets";
import { toInputValue } from "@/lib/money";
import type { Budget } from "@/lib/db/types";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, MoneyInput, Select, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { CategoryOptions, FormActions } from "./common";

export function BudgetForm({ kind, initial, onDone }: { kind: Budget["kind"]; initial?: Budget; onDone?: () => void }) {
  const lk = useLookups();
  const [onlyMonth, setOnlyMonth] = useState(Boolean(initial?.month));
  const { state, formAction, pending, fe } = useFormAction(saveBudget, onDone);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      {kind === "category" && (
        <Select name="category_id" label="Kategorie" defaultValue={initial?.category_id ?? ""} error={fe("category_id")}>
          <CategoryOptions kind="expense" includeEmpty="— vyberte —" />
        </Select>
      )}
      <MoneyInput name="amount" label={kind === "food" ? "Měsíční rozpočet na jídlo" : "Měsíční limit"} defaultValue={toInputValue(initial?.amount)} error={fe("amount")} required autoFocus />
      <Toggle label="Jen pro konkrétní měsíc" description="Jinak platí každý měsíc (výchozí)" checked={onlyMonth} onChange={(e) => setOnlyMonth(e.target.checked)} />
      {onlyMonth && <Input name="month" type="month" label="Měsíc" defaultValue={initial?.month?.slice(0, 7) ?? lk.today.slice(0, 7)} error={fe("month")} />}
      {kind === "food" && <p className="text-xs text-ink-3">Do rozpočtu na jídlo se počítají kategorie označené „Započítat do rozpočtu na jídlo“ (výchozí: Potraviny).</p>}
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}

export function BudgetButton({ kind, initial, label, variant = "secondary", size = "sm" }: { kind: Budget["kind"]; initial?: Budget; label?: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "icon" }) {
  const title = kind === "food" ? "Rozpočet na jídlo" : kind === "total" ? "Celkový měsíční rozpočet" : "Limit kategorie";
  return <ModalButton label={label} title={title} variant={variant} size={size} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} render={(close) => <BudgetForm kind={kind} initial={initial} onDone={close} />} />;
}
