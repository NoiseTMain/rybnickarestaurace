"use client";
import { Pencil, Plus } from "lucide-react";
import { saveAccount, saveCategory, saveIncomeSource, saveMember } from "@/lib/actions/setup";
import { toInputValue } from "@/lib/money";
import type { Account, Category, IncomeSource, Member } from "@/lib/db/types";
import { ACCOUNT_KIND_LABEL, MEMBER_COLORS } from "@/lib/defaults";
import { FREQUENCY_LABEL } from "@/lib/finance/recurrence";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, MoneyInput, Select, Textarea, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { useState } from "react";
import { AccountOptions, CategoryOptions, FormActions, MemberOptions } from "./common";

function ColorPicker({ name, initial }: { name: string; initial?: string }) {
  const [c, setC] = useState(initial ?? MEMBER_COLORS[0]);
  return (
    <div>
      <input type="hidden" name={name} value={c} />
      <div className="flex flex-wrap gap-2">
        {[...MEMBER_COLORS, "#7fb3d5", "#ffab91", "#b0bec5", "#80cbc4"].filter((v, i, a) => a.indexOf(v) === i).map((col) => (
          <button key={col} type="button" onClick={() => setC(col)} aria-label={`Barva ${col}`} className={`h-7 w-7 rounded-full border-2 ${c === col ? "border-ink" : "border-transparent"}`} style={{ background: col }} />
        ))}
      </div>
    </div>
  );
}

export function MemberForm({ initial, onDone }: { initial?: Member; onDone?: () => void }) {
  const { state, formAction, pending, fe } = useFormAction(saveMember, onDone);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Input name="name" label="Jméno" defaultValue={initial?.name} error={fe("name")} required autoFocus />
      <ColorPicker name="color" initial={initial?.color} />
      <Toggle name="is_active" label="Aktivní člen" defaultChecked={initial?.is_active ?? true} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}

export function AccountForm({ initial, onDone }: { initial?: Account; onDone?: () => void }) {
  const lk = useLookups();
  const [kind, setKind] = useState<Account["kind"]>(initial?.kind ?? "checking");
  const { state, formAction, pending, fe } = useFormAction(saveAccount, onDone);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Input name="name" label="Název" placeholder="např. Běžný účet Fio" defaultValue={initial?.name} error={fe("name")} required autoFocus />
      <Select name="kind" label="Typ" value={kind} onChange={(e) => setKind(e.target.value as Account["kind"])}>
        {Object.entries(ACCOUNT_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="opening_balance" label="Zůstatek k datu" defaultValue={toInputValue(initial?.opening_balance ?? null)} error={fe("opening_balance")} required />
        <Input name="opening_date" type="date" label="K datu" defaultValue={initial?.opening_date ?? lk.today} error={fe("opening_date")} required />
      </div>
      <p className="text-xs text-ink-3">Zůstatek zahrnuje všechny pohyby do tohoto data včetně. Transakce s dřívějším datem se do zůstatku nepočítají (zabrání to dvojímu započtení při importu historie).</p>
      <Toggle key={kind} name="include_in_available" label="Počítat do disponibilních peněz" description="Běžný účet a hotovost ano, spořicí účet obvykle ne." defaultChecked={initial ? initial.include_in_available : kind !== "savings"} />
      <Select name="member_id" label="Majitel" defaultValue={initial?.member_id ?? ""}>
        <MemberOptions includeEmpty="Společný" />
      </Select>
      <Toggle name="is_active" label="Aktivní" defaultChecked={initial?.is_active ?? true} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}

export function CategoryForm({ initial, kind = "expense", onDone }: { initial?: Category; kind?: "expense" | "income"; onDone?: () => void }) {
  const [k, setK] = useState(initial?.kind ?? kind);
  const { state, formAction, pending, fe } = useFormAction(saveCategory, onDone);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="icon" value={initial?.icon ?? "circle"} />
      <Input name="name" label="Název" defaultValue={initial?.name} error={fe("name")} required autoFocus />
      <Select name="kind" label="Druh" value={k} onChange={(e) => setK(e.target.value as "expense" | "income")}>
        <option value="expense">Výdaj</option>
        <option value="income">Příjem</option>
      </Select>
      <ColorPicker name="color" initial={initial?.color} />
      {k === "expense" && (
        <>
          <Toggle name="is_food" label="Započítat do rozpočtu na jídlo" defaultChecked={initial?.is_food} />
          <Toggle name="is_household" label="Domácí výdaj" description="Zobrazí se v přehledu Domácnost" defaultChecked={initial?.is_household ?? true} />
        </>
      )}
      {initial && <Toggle name="is_archived" label="Archivovat" description="Kategorie zůstane u starých záznamů, ale nebude v nabídce" defaultChecked={initial.is_archived} />}
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}

export function IncomeSourceForm({ initial, onDone }: { initial?: IncomeSource; onDone?: () => void }) {
  const lk = useLookups();
  const { state, formAction, pending, fe } = useFormAction(saveIncomeSource, onDone);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Input name="name" label="Název" placeholder="např. Mzda, rodičovský příspěvek" defaultValue={initial?.name} error={fe("name")} required autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="amount" label="Očekávaná částka" defaultValue={toInputValue(initial?.amount)} error={fe("amount")} required />
        <Select name="frequency" label="Frekvence" defaultValue={initial?.frequency ?? "monthly"}>
          {Object.entries(FREQUENCY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="start_date" type="date" label="Nejbližší termín" defaultValue={initial?.start_date ?? lk.today} error={fe("start_date")} required />
        <Input name="end_date" type="date" label="Do (nepovinné)" defaultValue={initial?.end_date ?? ""} error={fe("end_date")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select name="member_id" label="Kdo" defaultValue={initial?.member_id ?? ""}><MemberOptions /></Select>
        <Select name="account_id" label="Na účet" defaultValue={initial?.account_id ?? ""}><AccountOptions includeEmpty="— vyberte —" /></Select>
      </div>
      <Select name="category_id" label="Kategorie" defaultValue={initial?.category_id ?? ""}><CategoryOptions kind="income" /></Select>
      <Toggle name="is_active" label="Aktivní" defaultChecked={initial?.is_active ?? true} />
      <Textarea name="note" label="Poznámka" defaultValue={initial?.note ?? ""} />
      <p className="text-xs text-ink-3">Očekávaný příjem se do dostupných peněz započítá až ve chvíli, kdy ho označíte jako přijatý.</p>
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}

export function SetupButton({ kind, initial, label, size = "sm", variant = "secondary" }: {
  kind: "member" | "account" | "category" | "income";
  initial?: Member | Account | Category | IncomeSource;
  label?: string;
  size?: "sm" | "md" | "icon";
  variant?: "primary" | "secondary" | "ghost";
}) {
  const titles = { member: "člena", account: "účet", category: "kategorii", income: "pravidelný příjem" } as const;
  return (
    <ModalButton
      label={label}
      size={size}
      variant={variant}
      icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      title={`${initial ? "Upravit" : "Přidat"} ${titles[kind]}`}
      render={(close) =>
        kind === "member" ? <MemberForm initial={initial as Member} onDone={close} />
        : kind === "account" ? <AccountForm initial={initial as Account} onDone={close} />
        : kind === "category" ? <CategoryForm initial={initial as Category} onDone={close} />
        : <IncomeSourceForm initial={initial as IncomeSource} onDone={close} />
      }
    />
  );
}
