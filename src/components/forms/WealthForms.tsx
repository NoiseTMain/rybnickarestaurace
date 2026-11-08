"use client";
import { Pencil, Plus } from "lucide-react";
import { saveAsset, saveDebt, saveReminder } from "@/lib/actions/wealth";
import { toInputValue } from "@/lib/money";
import type { Asset, Debt, Reminder } from "@/lib/db/types";
import { ASSET_KIND_LABEL, REMINDER_KIND } from "@/lib/finance/networth";
import { FormError, Input, MoneyInput, Select, Textarea, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { FormActions } from "./common";

type Btn = { label?: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "icon" };

function AssetForm({ initial, onDone }: { initial?: Asset; onDone?: () => void }) {
  const { state, formAction, pending, fe } = useFormAction(saveAsset, onDone);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Input name="name" label="Název" placeholder="např. Byt Brno, ETF portfolio, Škoda Octavia" defaultValue={initial?.name} error={fe("name")} required autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Select name="kind" label="Druh" defaultValue={initial?.kind ?? "investment"}>
          {Object.entries(ASSET_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <MoneyInput name="value" label="Současná hodnota" defaultValue={toInputValue(initial?.value)} error={fe("value")} required />
      </div>
      <p className="text-xs text-ink-3">Hodnotu odhadněte střízlivě (za kolik byste to dnes prodali). Účty a spoření se počítají automaticky – sem je nezadávejte.</p>
      <Textarea name="note" label="Poznámka" defaultValue={initial?.note ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}
export function AssetButton({ initial, label, variant = "secondary", size = "sm" }: { initial?: Asset } & Btn) {
  return <ModalButton label={label} variant={variant} size={size} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit majetek" : "Přidat majetek"} render={(close) => <AssetForm initial={initial} onDone={close} />} />;
}

function DebtForm({ initial, onDone }: { initial?: Debt; onDone?: () => void }) {
  const { state, formAction, pending, fe } = useFormAction(saveDebt, onDone);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Input name="name" label="Název" placeholder="např. Hypotéka, Kreditní karta, Půjčka na auto" defaultValue={initial?.name} error={fe("name")} required autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="balance" label="Zbývá splatit" defaultValue={toInputValue(initial?.balance)} error={fe("balance")} required />
        <Input name="rate" label="Úrok % ročně" inputMode="decimal" defaultValue={initial ? String(initial.rate).replace(".", ",") : ""} error={fe("rate")} placeholder="např. 5,9" />
      </div>
      <MoneyInput name="min_payment" label="Měsíční splátka" defaultValue={toInputValue(initial?.min_payment ?? null)} error={fe("min_payment")} />
      <Textarea name="note" label="Poznámka" defaultValue={initial?.note ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}
export function DebtButton({ initial, label, variant = "secondary", size = "sm" }: { initial?: Debt } & Btn) {
  return <ModalButton label={label} variant={variant} size={size} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit dluh" : "Přidat dluh"} render={(close) => <DebtForm initial={initial} onDone={close} />} />;
}

function ReminderForm({ initial, today, onDone }: { initial?: Reminder; today: string; onDone?: () => void }) {
  const { state, formAction, pending, fe } = useFormAction(saveReminder, onDone);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Input name="title" label="Co hlídat" placeholder="např. STK Octavia, záruka pračky, konec fixace" defaultValue={initial?.title} error={fe("title")} required autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Select name="kind" label="Druh" defaultValue={initial?.kind ?? "other"}>
          {Object.entries(REMINDER_KIND).map(([v, k]) => <option key={v} value={v}>{k.emoji} {k.label}</option>)}
        </Select>
        <Input name="due_date" type="date" label="Termín" defaultValue={initial?.due_date ?? today} error={fe("due_date")} required />
      </div>
      <Select name="notify_days" label="Upozornit předem" defaultValue={String(initial?.notify_days ?? 14)}>
        {[0, 3, 7, 14, 30, 60, 90, 180].map((d) => <option key={d} value={d}>{d === 0 ? "v den termínu" : `${d} dní předem`}</option>)}
      </Select>
      <Toggle name="repeat_yearly" label="Opakovat každý rok" description="např. pojištění, daňové přiznání" defaultChecked={initial?.repeat_yearly} />
      <Textarea name="note" label="Poznámka" defaultValue={initial?.note ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}
export function ReminderButton({ initial, today, label, variant = "secondary", size = "sm" }: { initial?: Reminder; today: string } & Btn) {
  return <ModalButton label={label} variant={variant} size={size} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit termín" : "Nový termín"} render={(close) => <ReminderForm initial={initial} today={today} onDone={close} />} />;
}
