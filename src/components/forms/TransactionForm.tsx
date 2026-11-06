"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { saveTransaction } from "@/lib/actions/transactions";
import { toInputValue } from "@/lib/money";
import type { Transaction, TxType } from "@/lib/db/types";
import { PAYMENT_METHOD_LABEL } from "@/lib/defaults";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, MoneyInput, Segmented, Select, Textarea, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { AccountOptions, AttachDocument, CategoryOptions, FormActions, MemberOptions } from "./common";

export function TransactionForm({ initial, defaultType = "expense", onDone }: { initial?: Transaction; defaultType?: TxType; onDone?: () => void }) {
  const lk = useLookups();
  const [type, setType] = useState<TxType>(initial?.type ?? defaultType);
  const { state, formAction, pending, fe } = useFormAction(saveTransaction, onDone);
  const firstAccount = lk.accounts.find((a) => a.is_active && a.include_in_available)?.id ?? lk.accounts[0]?.id;
  if (!lk.accounts.length) {
    return <p className="text-sm text-ink-2">Nejdřív si v <a className="text-gold underline" href="/nastaveni#ucty">Nastavení</a> přidejte účet nebo hotovost.</p>;
  }
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Segmented name="type" value={type} onChange={setType} options={[{ value: "expense", label: "Výdaj" }, { value: "income", label: "Příjem" }, { value: "transfer", label: "Převod" }]} />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="amount" label="Částka" defaultValue={toInputValue(initial?.amount)} error={fe("amount")} autoFocus required />
        <Input name="date" type="date" label="Datum" defaultValue={initial?.date ?? lk.today} error={fe("date")} required />
      </div>
      {type !== "transfer" ? (
        <Select name="category_id" label="Kategorie" defaultValue={initial?.category_id ?? ""} error={fe("category_id")}>
          <CategoryOptions kind={type === "income" ? "income" : "expense"} current={initial?.category_id} />
        </Select>
      ) : null}
      <Input name="description" label="Popis" placeholder={type === "expense" ? "např. Nákup v Albertu" : type === "income" ? "např. Výplata" : "např. Na spořicí účet"} defaultValue={initial?.description ?? ""} error={fe("description")} maxLength={200} />
      <div className="grid grid-cols-2 gap-3">
        <Select name="account_id" label={type === "transfer" ? "Z účtu" : type === "income" ? "Na účet" : "Z účtu"} defaultValue={initial?.account_id ?? firstAccount} error={fe("account_id")}>
          <AccountOptions />
        </Select>
        {type === "transfer" ? (
          <Select name="transfer_account_id" label="Na účet" defaultValue={initial?.transfer_account_id ?? ""} error={fe("transfer_account_id")}>
            <AccountOptions includeEmpty="— vyberte —" />
          </Select>
        ) : (
          <Select name="payment_method" label="Způsob platby" defaultValue={initial?.payment_method ?? (type === "income" ? "transfer" : "card")}>
            {Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        )}
      </div>
      {type !== "transfer" && (
        <div className="grid grid-cols-2 gap-3">
          <Select name="member_id" label={type === "expense" ? "Kdo platil" : "Komu"} defaultValue={initial?.member_id ?? ""}>
            <MemberOptions />
          </Select>
          <Select name="scope" label="Typ" defaultValue={initial?.scope ?? "shared"}>
            <option value="shared">Společný</option>
            <option value="personal">Osobní</option>
          </Select>
        </div>
      )}
      {type !== "transfer" && <Toggle name="is_recurring" label="Pravidelná platba" description="Opakuje se (pro úplnou evidenci termínů použijte Pravidelné platby)" defaultChecked={initial?.is_recurring} />}
      {type === "expense" && <AttachDocument kind="receipt" initialId={initial?.document_id} />}
      {type !== "expense" && <input type="hidden" name="document_id" value={initial?.document_id ?? ""} />}
      <Textarea name="note" label="Poznámka" defaultValue={initial?.note ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel={initial ? "Uložit změny" : type === "expense" ? "Přidat výdaj" : type === "income" ? "Přidat příjem" : "Přidat převod"} />
    </form>
  );
}

export function TransactionButton({ initial, defaultType = "expense", label, variant = "secondary", size = "md" }: { initial?: Transaction; defaultType?: TxType; label?: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "icon" }) {
  return (
    <ModalButton
      label={label}
      title={initial ? "Upravit transakci" : defaultType === "income" ? "Nový příjem" : defaultType === "transfer" ? "Nový převod" : "Nový výdaj"}
      icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      variant={variant}
      size={size}
      render={(close) => <TransactionForm initial={initial} defaultType={defaultType} onDone={close} />}
    />
  );
}
