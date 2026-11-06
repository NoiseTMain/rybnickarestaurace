"use client";
import { Check, Copy, Pencil, Plus, RotateCcw, ShoppingCart, Trash2 } from "lucide-react";
import { useOptimistic, useRef, useTransition } from "react";
import {
  addShoppingItem, completeShoppingList, deleteShoppingItem, deleteShoppingList, duplicateShoppingList, reopenShoppingList, saveShoppingList, toggleShoppingItem,
} from "@/lib/actions/planning";
import { formatMoney, toInputValue } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { ShoppingItem, ShoppingList } from "@/lib/db/types";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, MoneyInput, Select, Textarea } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { ActionButton } from "@/components/ui/ActionButton";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { AccountOptions, CategoryOptions, FormActions } from "./common";

function ListForm({ initial, onDone }: { initial?: ShoppingList; onDone: () => void }) {
  const lk = useLookups();
  const { state, formAction, pending, fe } = useFormAction(saveShoppingList, onDone);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Input name="name" label="Název seznamu" placeholder="např. Velký nákup na víkend" defaultValue={initial?.name} error={fe("name")} required autoFocus />
      <Input name="planned_date" type="date" label="Kdy nakoupit" defaultValue={initial?.planned_date ?? lk.today} error={fe("planned_date")} />
      <Textarea name="note" label="Poznámka" placeholder="např. Lidl, Albert" defaultValue={initial?.note ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel={initial ? "Uložit" : "Vytvořit seznam"} />
    </form>
  );
}

export function ShoppingListButton({ initial, label, variant = "primary", size = "md" }: { initial?: ShoppingList; label?: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "icon" }) {
  return <ModalButton label={label} variant={variant} size={size} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit seznam" : "Nový nákupní seznam"} render={(close) => <ListForm initial={initial} onDone={close} />} />;
}

function AddItemForm({ listId }: { listId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const { state, formAction, pending, fe } = useFormAction(addShoppingItem, () => {
    ref.current?.reset();
    ref.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus();
  });
  return (
    <form ref={ref} action={formAction} className="mt-3 grid grid-cols-[1fr_5rem] gap-2 sm:grid-cols-[1fr_6rem_7.5rem_auto] sm:items-end">
      <input type="hidden" name="list_id" value={listId} />
      <Input name="name" placeholder="Přidat položku…" aria-label="Položka" error={fe("name")} required />
      <Input name="quantity" placeholder="ks, kg…" aria-label="Množství" />
      <MoneyInput name="est_price" placeholder="cena" aria-label="Odhad ceny" error={fe("est_price")} />
      <button type="submit" disabled={pending} className="flex h-[46px] items-center justify-center gap-1 rounded-[0.875rem] bg-gold px-3 text-sm font-medium text-[#1b1407] disabled:opacity-50" aria-label="Přidat položku">
        <Plus className="h-4 w-4" /><span className="sm:hidden">Přidat</span>
      </button>
      <FormError error={state.ok ? undefined : state.error} />
    </form>
  );
}

function ItemRow({ item, done }: { item: ShoppingItem; done: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(item.checked);
  const [, start] = useTransition();
  return (
    <li className="group flex items-center gap-3 py-2">
      <button type="button" disabled={done} aria-label={optimistic ? "Odškrtnout" : "Označit jako koupené"} aria-pressed={optimistic}
        onClick={() => start(async () => { setOptimistic(!optimistic); await toggleShoppingItem(item.id, !optimistic); })}
        className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition", optimistic ? "border-gold bg-gold text-[#1b1407]" : "border-white/25 hover:border-gold")}>
        {optimistic && <Check className="h-3.5 w-3.5" />}
      </button>
      <span className={cn("min-w-0 flex-1 truncate text-sm", optimistic && "text-ink-3 line-through")}>{item.name}{item.quantity && <span className="ml-1.5 text-xs text-ink-3">{item.quantity}</span>}</span>
      {item.est_price != null && <span className="num text-sm text-ink-2">{formatMoney(item.est_price)}</span>}
      {!done && <ActionButton action={() => deleteShoppingItem(item.id)} size="icon" icon={<Trash2 className="h-3.5 w-3.5" />} className="opacity-60 group-hover:opacity-100" />}
    </li>
  );
}

function CompleteForm({ list, estimate, onDone }: { list: ShoppingList; estimate: number; onDone: () => void }) {
  const lk = useLookups();
  const food = lk.categories.find((c) => c.is_food && !c.is_archived);
  const { state, formAction, pending, fe } = useFormAction(completeShoppingList, onDone);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={list.id} />
      <p className="text-sm text-ink-2">Zadejte skutečnou částku z účtenky. Zapíše se jako výdaj a rozpočet na jídlo se hned přepočítá.</p>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="amount" label="Zaplaceno" defaultValue={estimate ? toInputValue(estimate) : ""} error={fe("amount")} required autoFocus />
        <Input name="date" type="date" label="Datum" defaultValue={lk.today} error={fe("date")} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select name="account_id" label="Z účtu" defaultValue={lk.accounts.find((a) => a.include_in_available)?.id} error={fe("account_id")}><AccountOptions /></Select>
        <Select name="category_id" label="Kategorie" defaultValue={food?.id ?? ""}><CategoryOptions kind="expense" /></Select>
      </div>
      <Input name="note" label="Poznámka" placeholder="např. obchod" />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel="Zapsat nákup" />
    </form>
  );
}

/** Karta nákupního seznamu s položkami, odhadem ceny a porovnáním s rozpočtem. */
export function ShoppingListCard({ list, items, weekLimit, remaining, spent }: { list: ShoppingList; items: ShoppingItem[]; weekLimit: number | null; remaining: number | null; spent: number | null }) {
  const done = list.status === "done";
  const estimate = items.reduce((a, i) => a + (i.est_price ?? 0), 0);
  const missingPrices = items.filter((i) => i.est_price == null).length;
  const checked = items.filter((i) => i.checked).length;
  const over = remaining != null && estimate > remaining ? "danger" : weekLimit != null && estimate > weekLimit ? "warning" : null;
  return (
    <Card variant={done ? "glass" : "dark"} className={cn(done && "opacity-80")}
      title={<span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-gold" />{list.name}</span>}
      subtitle={[list.planned_date && formatDate(list.planned_date, "day"), `${checked}/${items.length} položek`, list.note].filter(Boolean).join(" · ")}
      action={
        <div className="flex">
          {!done && <ShoppingListButton initial={list} size="icon" variant="ghost" />}
          <ActionButton action={() => duplicateShoppingList(list.id)} size="icon" icon={<Copy className="h-4 w-4" />} />
          {done && <ActionButton action={() => reopenShoppingList(list.id)} confirm="Znovu otevřít seznam? Zapsaný výdaj bude stornován." size="icon" icon={<RotateCcw className="h-4 w-4" />} />}
          <ActionButton action={() => deleteShoppingList(list.id)} confirm="Smazat seznam?" size="icon" icon={<Trash2 className="h-4 w-4" />} />
        </div>
      }>
      {items.length ? (
        <ul className="divide-y divide-white/[0.05]">{items.map((i) => <ItemRow key={i.id} item={i} done={done} />)}</ul>
      ) : <p className="text-sm text-ink-3">Seznam je zatím prázdný.</p>}
      {!done && <AddItemForm listId={list.id} />}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
        <div className="mr-auto text-sm">
          <span className="text-ink-3">{done ? "Zaplaceno " : "Odhad "}</span>
          <span className="num font-semibold">{formatMoney(done && spent != null ? spent : estimate)}</span>
          {!done && missingPrices > 0 && <span className="ml-1 text-xs text-ink-3">({missingPrices} bez ceny)</span>}
        </div>
        {!done && over === "danger" && <Badge tone="danger">víc než zbývá na celý měsíc</Badge>}
        {!done && over === "warning" && <Badge tone="warning">přesahuje limit do konce týdne</Badge>}
        {!done && !over && estimate > 0 && weekLimit != null && <Badge tone="positive">vejde se do týdne</Badge>}
        {done ? <Badge tone="positive">nakoupeno</Badge> : (
          <ModalButton label="Nakoupeno" variant="primary" size="sm" icon={<Check className="h-4 w-4" />} title={`Nakoupeno: ${list.name}`} render={(close) => <CompleteForm list={list} estimate={estimate} onDone={close} />} />
        )}
      </div>
    </Card>
  );
}
