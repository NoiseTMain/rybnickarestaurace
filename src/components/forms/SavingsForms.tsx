"use client";
import { ArrowDownToLine, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { addContribution, saveGoal } from "@/lib/actions/savings";
import { toInputValue } from "@/lib/money";
import type { SavingsGoal } from "@/lib/db/types";
import { GOAL_KIND_LABEL } from "@/lib/defaults";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, MoneyInput, Segmented, Select, Textarea, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { AccountOptions, FormActions } from "./common";

export function GoalForm({ initial, onDone }: { initial?: SavingsGoal; onDone?: () => void }) {
  const { state, formAction, pending, fe } = useFormAction(saveGoal, onDone);
  const lk = useLookups();
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="color" value={initial?.color ?? "#d4b483"} />
      <Input name="name" label="Název cíle" placeholder="např. Rezerva na 6 měsíců" defaultValue={initial?.name} error={fe("name")} required autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Select name="kind" label="Druh" defaultValue={initial?.kind ?? "other"}>
          {Object.entries(GOAL_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select name="priority" label="Priorita" defaultValue={String(initial?.priority ?? 3)}>
          {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>{p === 1 ? "1 – nejvyšší" : p === 5 ? "5 – nejnižší" : p}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="target_amount" label="Cílová částka" defaultValue={toInputValue(initial?.target_amount)} error={fe("target_amount")} required />
        <Input name="target_date" type="date" label="Termín" hint="nepovinné" defaultValue={initial?.target_date ?? ""} error={fe("target_date")} />
      </div>
      <MoneyInput name="monthly_contribution" label="Pravidelný měsíční vklad" hint="nepovinné" defaultValue={toInputValue(initial?.monthly_contribution ?? null)} error={fe("monthly_contribution")} />
      <p className="text-xs text-ink-3">Má-li cíl termín, aplikace sama spočítá, kolik je nutné odkládat měsíčně. Pravidelný vklad použije, je-li vyšší nebo termín chybí.</p>
      {!initial && <MoneyInput name="initial_amount" label="Už naspořeno" hint="nepovinné" error={fe("initial_amount")} />}
      {lk.members.some((m) => m.is_child) && (
        <Select name="member_id" label="Pro koho" defaultValue={initial?.member_id ?? ""}>
          <option value="">Celá domácnost</option>
          {lk.members.filter((m) => m.is_child).map((m) => <option key={m.id} value={m.id}>{m.name} (dítě)</option>)}
        </Select>
      )}
      <Select name="account_id" label="Kde jsou peníze uložené" defaultValue={initial?.account_id ?? ""}>
        <AccountOptions includeEmpty="Vyčleněno na běžném účtu (rezervace)" />
      </Select>
      {initial && (
        <Select name="status" label="Stav" defaultValue={initial.status}>
          <option value="active">Aktivní</option>
          <option value="achieved">Splněno</option>
          <option value="archived">Archivováno</option>
        </Select>
      )}
      <Textarea name="note" label="Poznámka" defaultValue={initial?.note ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}

export function GoalButton({ initial, label, variant = "secondary", size = "sm" }: { initial?: SavingsGoal; label?: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "icon" }) {
  return <ModalButton label={label} variant={variant} size={size} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit cíl" : "Nový spořicí cíl"} render={(close) => <GoalForm initial={initial} onDone={close} />} />;
}

export function ContributionForm({ goalId, onDone }: { goalId?: string; onDone?: () => void }) {
  const lk = useLookups();
  const goals = lk.goals.filter((g) => g.status === "active");
  const [gid, setGid] = useState(goalId ?? goals[0]?.id ?? "");
  const [dir, setDir] = useState<"deposit" | "withdraw">("deposit");
  const goal = goals.find((g) => g.id === gid);
  const goalAccount = lk.accounts.find((a) => a.id === goal?.account_id);
  const [transfer, setTransfer] = useState(Boolean(goalAccount && !goalAccount.include_in_available));
  const { state, formAction, pending, fe } = useFormAction(addContribution, onDone);
  if (!goals.length) return <p className="text-sm text-ink-2">Nejdřív vytvořte spořicí cíl v sekci <a href="/sporeni" className="text-gold underline">Spoření</a>.</p>;
  return (
    <form action={formAction} className="space-y-4">
      <Select name="goal_id" label="Cíl" value={gid} onChange={(e) => setGid(e.target.value)}>
        {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </Select>
      <Segmented name="direction" value={dir} onChange={setDir} options={[{ value: "deposit", label: "Vklad" }, { value: "withdraw", label: "Výběr" }]} />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="amount" label="Částka" error={fe("amount")} required autoFocus />
        <Input name="date" type="date" label="Datum" defaultValue={lk.today} error={fe("date")} required />
      </div>
      {goalAccount ? (
        <>
          <Toggle name="transfer" label={`Zapsat i převod ${dir === "deposit" ? "na" : "z"} účtu „${goalAccount.name}“`} description="Peníze se skutečně přesunou mezi účty" checked={transfer} onChange={(e) => setTransfer(e.target.checked)} />
          {transfer && <Select name="from_account_id" label={dir === "deposit" ? "Z účtu" : "Na účet"} error={fe("from_account_id")} defaultValue={lk.accounts.find((a) => a.include_in_available && a.id !== goalAccount.id)?.id}><AccountOptions /></Select>}
        </>
      ) : (
        <p className="text-xs text-ink-3">Peníze zůstávají na běžném účtu, ale jsou vyčleněné – nepočítají se do volných peněz.</p>
      )}
      <Input name="note" label="Poznámka" />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel={dir === "deposit" ? "Odložit" : "Vybrat"} />
    </form>
  );
}

export function ContributionButton({ goalId, label = "Vklad", variant = "secondary", size = "sm" }: { goalId?: string; label?: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" }) {
  return <ModalButton label={label} variant={variant} size={size} icon={<ArrowDownToLine className="h-4 w-4" />} title="Vklad na spoření" render={(close) => <ContributionForm goalId={goalId} onDone={close} />} />;
}
