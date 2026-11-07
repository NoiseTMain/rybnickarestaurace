"use client";
import { ArrowDown, ArrowUp, Check, Link2, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { MODE_ICON } from "./icons";
import { useEffect, useState, useTransition } from "react";
import { deleteLeg, deleteTrip, deleteTripExpense, getExchangeRate, linkTransactionToTrip, moveLeg, saveLeg, saveTrip, saveTripExpense } from "@/lib/actions/travel";
import { CARRIERS, CURRENCIES, fuelCost, KIND_LABEL, MODE_LABEL } from "@/lib/finance/travel";
import { formatMoney, parseMoney, toInputValue } from "@/lib/money";
import type { Trip, TripExpense, TripExpenseKind, TripLeg, TripLegMode } from "@/lib/db/types";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, MoneyInput, Select, Textarea, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { ActionButton } from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/Toast";
import { AccountOptions, FormActions } from "@/components/forms/common";
import { useRouter } from "next/navigation";


type Variant = "primary" | "secondary" | "ghost";

// ---------------------------------------------------------------------------
// Cesta

function TripForm({ initial, onDone }: { initial?: Trip; onDone: () => void }) {
  const router = useRouter();
  const { state, formAction, pending, fe } = useFormAction(saveTrip, (r) => {
    onDone();
    if (!initial && r.id) router.push(`/cestovani/${r.id}`);
  });
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Input name="name" label="Název cesty" placeholder="např. Léto v Chorvatsku" defaultValue={initial?.name} error={fe("name")} required autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Input name="destination" label="Kam" placeholder="např. Split" defaultValue={initial?.destination} error={fe("destination")} required />
        <Input name="country" label="Země" placeholder="např. Chorvatsko" defaultValue={initial?.country ?? ""} error={fe("country")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="start_date" type="date" label="Odjezd" defaultValue={initial?.start_date ?? ""} error={fe("start_date")} hint="nevyplněno = zatím jen nápad" />
        <Input name="end_date" type="date" label="Návrat" defaultValue={initial?.end_date ?? ""} error={fe("end_date")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <MoneyInput name="budget" label="Rozpočet celkem" placeholder="např. 25 000" defaultValue={toInputValue(initial?.budget)} error={fe("budget")} hint="vč. dopravy a ubytování" className="col-span-2" />
        <Input name="travelers" type="number" min={1} max={50} label="Osob" defaultValue={initial?.travelers ?? 1} error={fe("travelers")} />
      </div>
      <Select name="currency" label="Měna na místě" defaultValue={initial?.currency ?? "EUR"}>
        {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
      <Textarea name="note" label="Poznámka" placeholder="ubytování, co nezapomenout…" defaultValue={initial?.note ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel={initial ? "Uložit" : "Vytvořit cestu"} />
    </form>
  );
}

export function TripButton({ initial, label, variant = "primary", size = "md" }: { initial?: Trip; label?: string; variant?: Variant; size?: "sm" | "md" | "icon" }) {
  return <ModalButton label={label} variant={variant} size={size} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit cestu" : "Nová cesta"} render={(close) => <TripForm initial={initial} onDone={close} />} />;
}

export function DeleteTripButton({ id }: { id: string }) {
  const router = useRouter();
  return <ActionButton action={() => deleteTrip(id)} confirm="Smazat celou cestu včetně trasy a výdajů u cesty? Platby zapsané v příjmech a výdajích zůstanou." icon={<Trash2 className="h-4 w-4" />} onDone={() => router.push("/cestovani")}>Smazat</ActionButton>;
}

// ---------------------------------------------------------------------------
// Úsek trasy

function LegForm({ tripId, initial, last, onDone }: { tripId: string; initial?: TripLeg; last?: TripLeg | null; onDone: () => void }) {
  const lk = useLookups();
  const [mode, setMode] = useState<TripLegMode>(initial?.mode ?? last?.mode ?? "train");
  const [price, setPrice] = useState(toInputValue(initial?.price));
  const [km, setKm] = useState(initial?.distance_km?.toString() ?? "");
  const [cons, setCons] = useState("6,5");
  const [fuel, setFuel] = useState("38");
  const { state, formAction, pending, fe } = useFormAction(saveLeg, onDone);
  const fuelEstimate = fuelCost(Number(km), Number(cons.replace(",", ".")), parseMoney(fuel) ?? 0);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="trip_id" value={tripId} />
      <div>
        <p className="mb-1.5 text-sm text-ink-2">Čím pojedete</p>
        <input type="hidden" name="mode" value={mode} />
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(MODE_LABEL) as TripLegMode[]).map((m) => {
            const I = MODE_ICON[m];
            return (
              <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs ${mode === m ? "border-gold bg-gold/15 text-ink" : "border-white/10 text-ink-2"}`}>
                <I className="h-4 w-4" />{MODE_LABEL[m]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="from_place" label="Odkud" placeholder="Praha hl.n." defaultValue={initial?.from_place ?? last?.to_place ?? ""} error={fe("from_place")} required />
        <Input name="to_place" label="Kam" placeholder="Vídeň" defaultValue={initial?.to_place ?? ""} error={fe("to_place")} required />
      </div>
      <Input name="carrier" label={mode === "car" ? "Auto" : "Dopravce"} list={`carriers-${mode}`} placeholder={CARRIERS[mode]?.[0] ?? ""} defaultValue={initial?.carrier ?? ""} error={fe("carrier")} />
      <datalist id={`carriers-${mode}`}>{(CARRIERS[mode] ?? []).map((c) => <option key={c} value={c} />)}</datalist>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Input name="depart_date" type="date" label="Odjezd" defaultValue={initial?.depart_date ?? last?.arrive_date ?? lk.today} error={fe("depart_date")} />
        <Input name="depart_time" type="time" label="Čas" defaultValue={initial?.depart_time ?? ""} error={fe("depart_time")} />
        <Input name="arrive_date" type="date" label="Příjezd" defaultValue={initial?.arrive_date ?? ""} error={fe("arrive_date")} />
        <Input name="arrive_time" type="time" label="Čas" defaultValue={initial?.arrive_time ?? ""} error={fe("arrive_time")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="price" label="Cena (Kč)" placeholder="za všechny osoby" value={price} onChange={(e) => setPrice(e.target.value)} error={fe("price")} />
        <Input name="distance_km" inputMode="numeric" label="Vzdálenost (km)" placeholder="nepovinné" value={km} onChange={(e) => setKm(e.target.value)} error={fe("distance_km")} />
      </div>
      {mode === "car" && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-2 text-xs text-ink-2">Kalkulačka paliva</p>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Spotřeba l/100 km" value={cons} onChange={(e) => setCons(e.target.value)} inputMode="decimal" />
            <MoneyInput label="Cena za litr" value={fuel} onChange={(e) => setFuel(e.target.value)} />
          </div>
          <p className="mt-2 text-xs text-ink-3">{fuelEstimate > 0 ? <>Palivo ≈ <b className="text-ink">{formatMoney(fuelEstimate, { decimals: "never" })}</b> <button type="button" className="ml-1 text-gold underline" onClick={() => setPrice(toInputValue(fuelEstimate))}>použít jako cenu</button> (+ dálniční známky, mýto, parkování)</> : "Zadejte vzdálenost v km a spočítám palivo."}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Input name="booking_ref" label="Číslo rezervace / jízdenky" defaultValue={initial?.booking_ref ?? ""} />
        <Input name="url" label="Odkaz na jízdenku" placeholder="https://" defaultValue={initial?.url ?? ""} error={fe("url")} />
      </div>
      <Textarea name="note" label="Poznámka" placeholder="sedadlo, nástupiště, přestup…" defaultValue={initial?.note ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel={initial ? "Uložit" : "Přidat úsek"} />
    </form>
  );
}

export function LegButton({ tripId, initial, last, label, variant = "secondary", size = "md" }: { tripId: string; initial?: TripLeg; last?: TripLeg | null; label?: string; variant?: Variant; size?: "sm" | "md" | "icon" }) {
  return <ModalButton label={label} variant={variant} size={size} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit úsek" : "Nový úsek trasy"} render={(close) => <LegForm tripId={tripId} initial={initial} last={last} onDone={close} />} />;
}

export function LegActions({ leg, first, lastOne }: { leg: TripLeg; first: boolean; lastOne: boolean }) {
  return (
    <span className="flex items-center">
      {!first && <ActionButton action={() => moveLeg(leg.id, -1)} size="icon" icon={<ArrowUp className="h-4 w-4" />} className="!h-8 !w-8" />}
      {!lastOne && <ActionButton action={() => moveLeg(leg.id, 1)} size="icon" icon={<ArrowDown className="h-4 w-4" />} className="!h-8 !w-8" />}
      <LegButton tripId={leg.trip_id} initial={leg} variant="ghost" size="icon" />
      <ActionButton action={() => deleteLeg(leg.id)} confirm="Smazat úsek trasy?" size="icon" icon={<Trash2 className="h-4 w-4" />} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Výdaj na cestě

function ExpenseForm({ trip, initial, leg, planned, onDone }: { trip: Trip; initial?: TripExpense; leg?: TripLeg; planned?: boolean; onDone: () => void }) {
  const lk = useLookups();
  const paying = initial?.status === "planned" && !planned;
  const [status, setStatus] = useState<"planned" | "paid">(paying ? "paid" : initial?.status ?? (planned ? "planned" : "paid"));
  const [currency, setCurrency] = useState(initial?.currency ?? (leg ? "CZK" : trip.currency));
  const [orig, setOrig] = useState(toInputValue(initial?.amount_original));
  const [rate, setRate] = useState(initial?.rate ? String(Number(initial.rate.toFixed(4))).replace(".", ",") : "");
  const [czk, setCzk] = useState(toInputValue(initial?.amount ?? leg?.price));
  const [day, setDay] = useState(initial?.date ?? (paying ? lk.today : leg?.depart_date ?? (trip.start_date && lk.today < trip.start_date ? lk.today : lk.today)));
  const [rateInfo, setRateInfo] = useState<string | null>(null);
  const [recordTx, setRecordTx] = useState(!initial?.transaction_id);
  const { state, formAction, pending, fe } = useFormAction(saveTripExpense, onDone);

  useEffect(() => {
    if (currency === "CZK" || (initial?.rate && initial.currency === currency)) return;
    let off = false;
    getExchangeRate(currency, day || lk.today).then((r) => {
      if (off) return;
      if (r) { setRate(String(Number(r.rate.toFixed(4))).replace(".", ",")); setRateInfo(`kurz ČNB${r.date ? ` ze dne ${r.date.split("-").reverse().join(". ")}` : ""}`); }
      else setRateInfo("kurz ČNB se nepodařilo načíst – zadejte ho ručně");
    });
    return () => { off = true; };
  }, [currency, day, initial, lk.today]);

  const converted = currency !== "CZK" && parseMoney(orig) != null && Number(rate.replace(",", ".")) > 0 ? Math.round((parseMoney(orig) ?? 0) * Number(rate.replace(",", "."))) : null;
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="trip_id" value={trip.id} />
      <input type="hidden" name="leg_id" value={initial?.leg_id ?? leg?.id ?? ""} />
      <input type="hidden" name="status" value={status} />
      {!paying && !leg && (
        <div className="flex rounded-full border border-white/[0.08] bg-white/[0.05] p-1">
          {(["paid", "planned"] as const).map((s) => <button key={s} type="button" onClick={() => setStatus(s)} aria-pressed={status === s} className={`flex-1 rounded-full px-3 py-1.5 text-sm ${status === s ? "bg-ink font-medium text-base" : "text-ink-2"}`}>{s === "paid" ? "Zaplaceno" : "Plánuji zaplatit"}</button>)}
        </div>
      )}
      <Input name="description" label="Za co" placeholder="např. Večeře v konobě" defaultValue={initial?.description ?? (leg ? `${MODE_LABEL[leg.mode]} ${leg.from_place} → ${leg.to_place}` : "")} error={fe("description")} required autoFocus={!leg} />
      <div className="grid grid-cols-2 gap-3">
        <Select name="kind" label="Druh" defaultValue={initial?.kind ?? (leg ? "transport" : "food")}>
          {(Object.keys(KIND_LABEL) as TripExpenseKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </Select>
        <Input name="place" label="Kde" placeholder="město / podnik" defaultValue={initial?.place ?? (leg ? leg.from_place : trip.destination)} error={fe("place")} />
      </div>
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <Select name="currency" label="Měna" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        {currency === "CZK" ? (
          <MoneyInput name="amount" label="Částka (Kč)" value={czk} onChange={(e) => setCzk(e.target.value)} error={fe("amount")} required />
        ) : (
          <MoneyInput name="amount_original" label={`Částka (${currency})`} value={orig} onChange={(e) => setOrig(e.target.value)} error={fe("amount_original")} required />
        )}
      </div>
      {currency !== "CZK" && (
        <div>
          <Input name="rate" label={`Kurz (Kč za 1 ${currency})`} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} error={fe("rate")} hint={rateInfo ?? "načítám kurz ČNB…"} />
          {converted != null && <p className="mt-1 text-sm">= <b>{formatMoney(converted)}</b></p>}
        </div>
      )}
      <Input name="date" type="date" label={status === "planned" ? "Kdy zaplatit (nepovinné)" : "Datum"} value={day ?? ""} onChange={(e) => setDay(e.target.value)} error={fe("date")} />
      {status === "paid" && !initial?.transaction_id && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <Toggle name="record_tx" label="Zapsat i do výdajů domácnosti" description="odečte se z účtu a promítne do přehledů (kategorie Cestování)" checked={recordTx} onChange={(e) => setRecordTx(e.target.checked)} />
          {recordTx && (
            <div className="grid grid-cols-2 gap-3">
              <Select name="account_id" label="Z účtu" defaultValue={lk.accounts.find((a) => a.include_in_available)?.id} error={fe("account_id")}><AccountOptions /></Select>
              <Select name="payment_method" label="Platba" defaultValue="card">
                <option value="card">Kartou</option><option value="cash">Hotově</option><option value="transfer">Převodem</option><option value="other">Jinak</option>
              </Select>
            </div>
          )}
        </div>
      )}
      {(status !== "paid" || initial?.transaction_id || !recordTx) && <input type="hidden" name="payment_method" value="card" />}
      {initial?.transaction_id && <p className="text-xs text-ink-3">Výdaj je propojený s platbou v příjmech a výdajích – změna částky ji upraví také.</p>}
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel={paying ? "Zaplatit" : initial ? "Uložit" : status === "planned" ? "Naplánovat" : "Zapsat výdaj"} />
    </form>
  );
}

export function ExpenseButton({ trip, initial, leg, planned, label, variant = "secondary", size = "md", icon }: { trip: Trip; initial?: TripExpense; leg?: TripLeg; planned?: boolean; label?: string; variant?: Variant; size?: "sm" | "md" | "icon"; icon?: "pay" | "edit" }) {
  const title = leg ? "Zaplatit úsek" : initial?.status === "planned" && !planned && icon === "pay" ? "Zaplatit" : initial ? "Upravit výdaj" : "Výdaj na cestě";
  const ic = icon === "pay" || leg ? <Wallet className="h-4 w-4" /> : initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />;
  return <ModalButton label={label} variant={variant} size={size} icon={ic} title={title} render={(close) => <ExpenseForm trip={trip} initial={initial} leg={leg} planned={planned ?? (icon === "edit" && initial?.status === "planned")} onDone={close} />} />;
}

export function DeleteExpenseButton({ e }: { e: TripExpense }) {
  return <ActionButton action={() => deleteTripExpense(e.id)} confirm={e.transaction_id ? "Smazat výdaj? Propojená platba v příjmech a výdajích se stornuje." : "Smazat výdaj?"} size="icon" icon={<Trash2 className="h-4 w-4" />} />;
}

export function LinkTxRow({ tripId, tx }: { tripId: string; tx: { id: string; date: string; description: string; amount: number; category: string | null } }) {
  const [kind, setKind] = useState<TripExpenseKind>("other");
  const [pending, start] = useTransition();
  const [doneFlag, setDone] = useState(false);
  const toast = useToast();
  if (doneFlag) return null;
  return (
    <li className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] py-2 text-sm">
      <span className="w-16 shrink-0 text-xs text-ink-3">{tx.date.slice(8, 10)}. {tx.date.slice(5, 7)}.</span>
      <span className="min-w-0 flex-1 truncate">{tx.description}{tx.category && <span className="text-ink-3"> · {tx.category}</span>}</span>
      <span className="num">{formatMoney(tx.amount)}</span>
      <select aria-label="Druh" className="field !h-9 !w-auto !py-1 text-xs" value={kind} onChange={(e) => setKind(e.target.value as TripExpenseKind)}>
        {(Object.keys(KIND_LABEL) as TripExpenseKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
      </select>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await linkTransactionToTrip(tripId, tx.id, kind); if (r.ok) { setDone(true); toast(r.message ?? "Přiřazeno"); } else toast(r.error ?? "Chyba", "error"); })} className="flex items-center gap-1 rounded-full bg-gold/90 px-3 py-1 text-xs text-[#1b1407] disabled:opacity-50">
        {pending ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}Přiřadit
      </button>
    </li>
  );
}
