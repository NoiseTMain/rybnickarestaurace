"use client";
import { Pencil, Plus, ShoppingBag } from "lucide-react";
import { markBought, savePurchase } from "@/lib/actions/purchases";
import { toInputValue } from "@/lib/money";
import type { Purchase } from "@/lib/db/types";
import { PURCHASE_STATUS_LABEL } from "@/lib/defaults";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, MoneyInput, Select, Textarea, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { AccountOptions, CategoryOptions, FormActions } from "./common";

export function PurchaseForm({ initial, onDone }: { initial?: Purchase; onDone?: () => void }) {
  const { state, formAction, pending, fe } = useFormAction(savePurchase, onDone);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Input name="name" label="Co chci koupit" defaultValue={initial?.name} error={fe("name")} required autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="price" label="Cena" defaultValue={toInputValue(initial?.price)} error={fe("price")} required />
        <Select name="priority" label="Priorita" defaultValue={String(initial?.priority ?? 3)}>
          {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>{p === 1 ? "1 – nutné" : p === 5 ? "5 – jednou možná" : p}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select name="status" label="Stav" defaultValue={initial?.status ?? "planned"}>
          {Object.entries(PURCHASE_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Input name="planned_date" type="date" label="Plánované datum" defaultValue={initial?.planned_date ?? ""} error={fe("planned_date")} />
      </div>
      <Select name="category_id" label="Kategorie" defaultValue={initial?.category_id ?? ""}><CategoryOptions kind="expense" current={initial?.category_id} /></Select>
      <Input name="url" type="url" label="Odkaz na produkt" placeholder="https://" defaultValue={initial?.url ?? ""} error={fe("url")} />
      <Toggle name="is_wish" label="Seznam přání" description="Není nutné, jen by se líbilo" defaultChecked={initial?.is_wish} />
      <Textarea name="note" label="Poznámka" defaultValue={initial?.note ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}

export function PurchaseButton({ initial, label, variant = "secondary", size = "sm" }: { initial?: Purchase; label?: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "icon" }) {
  return <ModalButton label={label} variant={variant} size={size} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit nákup" : "Nový nákup"} render={(close) => <PurchaseForm initial={initial} onDone={close} />} />;
}

export function BoughtButton({ purchase }: { purchase: Purchase }) {
  return <ModalButton label="Koupeno" size="sm" variant="secondary" icon={<ShoppingBag className="h-4 w-4" />} title={`Koupeno: ${purchase.name}`} render={(close) => <BoughtForm purchase={purchase} onDone={close} />} />;
}

function BoughtForm({ purchase, onDone }: { purchase: Purchase; onDone: () => void }) {
  const lk = useLookups();
  const { state, formAction, pending, fe } = useFormAction(markBought, onDone);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={purchase.id} />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="amount" label="Skutečná cena" defaultValue={toInputValue(purchase.price || null)} error={fe("amount")} required />
        <Input name="date" type="date" label="Datum" defaultValue={lk.today} error={fe("date")} required />
      </div>
      <Select name="account_id" label="Zaplaceno z účtu" defaultValue={lk.accounts.find((a) => a.include_in_available)?.id} error={fe("account_id")}><AccountOptions /></Select>
      <Toggle name="create_transaction" label="Zapsat jako výdaj" description="Vypněte, pokud výdaj už máte zapsaný" defaultChecked />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel="Potvrdit" />
    </form>
  );
}
