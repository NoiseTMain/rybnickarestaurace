"use client";
import { Check, Pencil, Plus } from "lucide-react";
import { payOccurrence, receiveIncome, saveRecurring } from "@/lib/actions/payments";
import { formatMoney, toInputValue } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { RecurringPayment } from "@/lib/db/types";
import { FREQUENCY_LABEL } from "@/lib/finance/recurrence";
import { PAYMENT_METHOD_LABEL } from "@/lib/defaults";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, MoneyInput, Select, Textarea, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { useState } from "react";
import { AccountOptions, CategoryOptions, FormActions, MemberOptions } from "./common";

export function RecurringForm({ initial, onDone }: { initial?: RecurringPayment; onDone?: () => void }) {
  const lk = useLookups();
  const [debt, setDebt] = useState(initial?.is_debt ?? false);
  const { state, formAction, pending, fe } = useFormAction(saveRecurring, onDone);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Input name="name" label="Název" placeholder="např. Nájem, Netflix, splátka" defaultValue={initial?.name} error={fe("name")} required autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="amount" label="Částka" defaultValue={toInputValue(initial?.amount)} error={fe("amount")} required />
        <Select name="frequency" label="Frekvence" defaultValue={initial?.frequency ?? "monthly"}>
          {Object.entries(FREQUENCY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="start_date" type="date" label="Nejbližší splatnost" defaultValue={initial?.start_date ?? lk.today} error={fe("start_date")} required />
        <Input name="end_date" type="date" label="Poslední splatnost" hint="nepovinné" defaultValue={initial?.end_date ?? ""} error={fe("end_date")} />
      </div>
      <Select name="category_id" label="Kategorie" defaultValue={initial?.category_id ?? ""}><CategoryOptions kind="expense" current={initial?.category_id} /></Select>
      <div className="grid grid-cols-2 gap-3">
        <Select name="account_id" label="Z účtu" defaultValue={initial?.account_id ?? ""}><AccountOptions includeEmpty="— vyberte —" /></Select>
        <Select name="payment_method" label="Způsob" defaultValue={initial?.payment_method ?? "transfer"}>
          {Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>
      <Select name="member_id" label="Kdo platí" defaultValue={initial?.member_id ?? ""}><MemberOptions /></Select>
      <Toggle name="is_debt" label="Splátka dluhu / závazku" checked={debt} onChange={(e) => setDebt(e.target.checked)} />
      {debt && <MoneyInput name="debt_remaining" label="Zbývá doplatit" defaultValue={toInputValue(initial?.debt_remaining ?? null)} error={fe("debt_remaining")} />}
      <Toggle name="is_active" label="Aktivní" defaultChecked={initial?.is_active ?? true} />
      <Textarea name="note" label="Poznámka" defaultValue={initial?.note ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}

export function RecurringButton({ initial, label, size = "sm", variant = "secondary" }: { initial?: RecurringPayment; label?: string; size?: "sm" | "md" | "icon"; variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <ModalButton label={label} size={size} variant={variant} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      title={initial ? "Upravit platbu" : "Nová pravidelná platba"} render={(close) => <RecurringForm initial={initial} onDone={close} />} />
  );
}

/** Zaplacení konkrétního termínu (vznikne výdaj, jen jednou). */
export function PayOccurrenceButton({ kind, refId, name, occurrenceDate, amount, accountId }: { kind: "recurring" | "income"; refId: string; name: string; occurrenceDate: string; amount: number; accountId: string | null }) {
  const lk = useLookups();
  return (
    <ModalButton
      label={kind === "recurring" ? "Zaplaceno" : "Přišlo"}
      size="sm"
      variant="secondary"
      icon={<Check className="h-4 w-4" />}
      title={kind === "recurring" ? `Zaplatit: ${name}` : `Přijato: ${name}`}
      render={(close) => <PayForm kind={kind} refId={refId} occurrenceDate={occurrenceDate} amount={amount} accountId={accountId ?? lk.accounts.find((a) => a.include_in_available)?.id ?? ""} onDone={close} />}
    />
  );
}

function PayForm({ kind, refId, occurrenceDate, amount, accountId, onDone }: { kind: "recurring" | "income"; refId: string; occurrenceDate: string; amount: number; accountId: string; onDone: () => void }) {
  const lk = useLookups();
  const { state, formAction, pending, fe } = useFormAction(kind === "recurring" ? payOccurrence : receiveIncome, onDone);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name={kind === "recurring" ? "recurring_payment_id" : "income_source_id"} value={refId} />
      <input type="hidden" name="occurrence_date" value={occurrenceDate} />
      <p className="text-sm text-ink-2">Termín {formatDate(occurrenceDate)} · plán {formatMoney(amount)}. Zapíše se jako {kind === "recurring" ? "výdaj" : "příjem"} – každý termín jen jednou.</p>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="amount" label="Skutečná částka" defaultValue={toInputValue(amount)} error={fe("amount")} required />
        <Input name="date" type="date" label="Datum" defaultValue={lk.today < occurrenceDate ? lk.today : occurrenceDate} error={fe("date")} required />
      </div>
      <Select name="account_id" label="Účet" defaultValue={accountId} error={fe("account_id")}><AccountOptions /></Select>
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel="Potvrdit" />
    </form>
  );
}
