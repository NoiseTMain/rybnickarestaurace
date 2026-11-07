"use client";
import { Check, Copy, ExternalLink, Pencil, Plus, RotateCcw, ShoppingCart, Sparkles, Tag, Trash2, Truck } from "lucide-react";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { kupiSearchUrl, rohlikSearchUrl, STORES } from "@/lib/shops";
import { suggestPrice, type PriceSuggestion } from "@/lib/actions/planning";
import {
  addShoppingItem, completeShoppingList, deleteShoppingItem, deleteShoppingList, duplicateShoppingList, reopenShoppingList, saveShoppingList, toggleShoppingItem,
} from "@/lib/actions/planning";
import { formatMoney, toInputValue } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { kupiLeafletUrl } from "@/lib/shops";
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
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [store, setStore] = useState("");
  const [sugg, setSugg] = useState<PriceSuggestion | null>(null);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const { state, formAction, pending, fe } = useFormAction(addShoppingItem, () => {
    setName(""); setQty(""); setPrice(""); setSugg(null);
    ref.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus();
  });
  // návrh ceny z cenové paměti / AI odhad (s prodlevou po psaní)
  useEffect(() => {
    if (name.trim().length < 3) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoadingSugg(true);
      const r = await suggestPrice(name, qty || null).catch(() => null);
      if (!cancelled) { setSugg(r); setLoadingSugg(false); }
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [name, qty]);
  const use = (p: number, st: string | null) => { setPrice(toInputValue(p)); if (st) setStore(st); };
  return (
    <form ref={ref} action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="list_id" value={listId} />
      <div className="grid grid-cols-[1fr_5rem] gap-2 sm:grid-cols-[1fr_6rem_7.5rem_8rem_auto] sm:items-end">
        <Input name="name" placeholder="Přidat položku…" aria-label="Položka" value={name} onChange={(e) => setName(e.target.value)} error={fe("name")} required />
        <Input name="quantity" placeholder="ks, kg…" aria-label="Množství" value={qty} onChange={(e) => setQty(e.target.value)} />
        <MoneyInput name="est_price" placeholder="cena" aria-label="Odhad ceny" value={price} onChange={(e) => setPrice(e.target.value)} error={fe("est_price")} />
        <select name="store" aria-label="Obchod" className="field" value={store} onChange={(e) => setStore(e.target.value)}>
          <option value="">obchod</option>
          {STORES.map((s) => <option key={s.key} value={s.key}>{s.key}</option>)}
        </select>
        <button type="submit" disabled={pending} className="col-span-2 flex h-[46px] items-center justify-center gap-1 rounded-[0.875rem] bg-gold px-3 text-sm font-medium text-[#1b1407] disabled:opacity-50 sm:col-span-1" aria-label="Přidat položku">
          <Plus className="h-4 w-4" /><span className="sm:hidden">Přidat</span>
        </button>
      </div>
      {name.trim().length >= 3 && (sugg || loadingSugg) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {loadingSugg && <span className="text-ink-3">Hledám cenu…</span>}
          {sugg?.history.map((h) => (
            <button key={`${h.store}-${h.date}`} type="button" onClick={() => use(h.price, h.store)} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 hover:border-gold/50">
              <Tag className="h-3 w-3 text-gold" />{h.store ?? "dříve"} {formatMoney(h.price)}<span className="text-ink-3">· {formatDate(h.date)}</span>
            </button>
          ))}
          {sugg?.average != null && sugg.history.length > 1 && <span className="text-ink-3">průměr {formatMoney(sugg.average)}</span>}
          {sugg?.ai && (
            <button type="button" onClick={() => use(sugg.ai!.typical, null)} className="inline-flex items-center gap-1 rounded-full border border-info/30 bg-info/10 px-2.5 py-1 text-info" title={sugg.ai.note}>
              <Sparkles className="h-3 w-3" />odhad AI ~{formatMoney(sugg.ai.typical, { decimals: "never" })} ({formatMoney(sugg.ai.low, { decimals: "never" })}–{formatMoney(sugg.ai.high, { decimals: "never" })}) – ověřte
            </button>
          )}
          {name.trim().length >= 3 && <a href={kupiSearchUrl(name)} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-gold hover:underline"><ExternalLink className="h-3 w-3" />akce na kupi.cz</a>}
        </div>
      )}
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
      <span className={cn("min-w-0 flex-1 text-sm", optimistic && "text-ink-3 line-through")}>
        <span className="block truncate">{item.name}{item.quantity && <span className="ml-1.5 text-xs text-ink-3">{item.quantity}</span>}</span>
        {!done && !optimistic && (
          <span className="flex gap-2 text-[11px]">
            {item.store && <span className="text-ink-3">{item.store}</span>}
            <a href={kupiSearchUrl(item.name)} target="_blank" rel="noreferrer noopener" className="text-gold/80 hover:underline">akce</a>
            <a href={rohlikSearchUrl(item.name)} target="_blank" rel="noreferrer noopener" className="text-gold/80 hover:underline">Rohlík</a>
          </span>
        )}
      </span>
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

/** Akční letáky vybraných obchodů (kupi.cz) a nákup s doručením (Rohlík.cz). */
export function LeafletsPanel({ items }: { items: string[] }) {
  return (
    <Card title={<span className="flex items-center gap-2"><Tag className="h-4 w-4 text-gold" />Akční letáky a nákup domů</span>} subtitle="Odkazy se otevřou v novém okně">
      <div className="flex flex-wrap gap-2">
        {STORES.filter((s) => s.kupi).map((s) => (
          <a key={s.key} href={kupiLeafletUrl(s.kupi!)} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm hover:border-gold/50 hover:text-ink">
            {s.key}<ExternalLink className="h-3 w-3 text-ink-3" />
          </a>
        ))}
        <a href="https://www.kupi.cz/" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-gold hover:underline">Všechny letáky na kupi.cz</a>
      </div>
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center">
        <Truck className="h-6 w-6 shrink-0 text-gold" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Ušetřete čas – nakupte s doručením až ke dveřím</p>
          <p className="text-xs text-ink-3">U každé položky v seznamu je odkaz „Rohlík“, který ji rovnou vyhledá na Rohlík.cz. Košík pak dokončíte tam.</p>
        </div>
        <a href={items[0] ? rohlikSearchUrl(items[0]) : "https://www.rohlik.cz/"} target="_blank" rel="noreferrer noopener" className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gold px-4 text-sm font-medium text-[#1b1407]">
          Otevřít Rohlík.cz<ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </Card>
  );
}
