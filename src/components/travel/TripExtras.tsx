"use client";
import { Check, Copy, FileText, Link2, PiggyBank, Plus, Sparkles, Trash2, UserPlus, Users, X } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addChecklistItem, addMembersToTrip, addTripPerson, attachDocumentToTrip, createGoalForTrip, deleteCashMove, deleteChecklistItem, deletePlanItem,
  deleteTripPerson, detachDocumentFromTrip, duplicateTrip, fillChecklist, linkSuggestedTransactions, saveCashMove, savePlanItem, toggleChecklistItem, unlinkGoal,
} from "@/lib/actions/travel";
import { getExchangeRate } from "@/lib/actions/travel";
import { CURRENCIES } from "@/lib/finance/travel";
import { formatMoney, parseMoney } from "@/lib/money";
import type { Trip, TripChecklistItem, TripPerson, TripPlanItem } from "@/lib/db/types";
import { uploadDocument } from "@/lib/upload-client";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, MoneyInput, Select, Textarea, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { ActionButton } from "@/components/ui/ActionButton";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { AccountOptions, FormActions } from "@/components/forms/common";
import { cn } from "@/components/ui/cn";

function useRun() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) { if (r.message) toast(r.message); after?.(); } else toast(r.error ?? "Nepovedlo se", "error");
    });
  return { pending, run };
}

// ---------------------------------------------------------------------------
// Účastníci

export function PeopleEditor({ tripId, people, edit }: { tripId: string; people: TripPerson[]; edit: boolean }) {
  const [name, setName] = useState("");
  const { pending, run } = useRun();
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {people.map((p) => (
          <span key={p.id} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] py-1 pl-3 pr-1 text-sm">
            {p.name}
            {edit && <button type="button" aria-label={`Odebrat ${p.name}`} onClick={() => confirm(`Odebrat ${p.name} z cesty?`) && run(() => deleteTripPerson(p.id))} className="rounded-full p-1 text-ink-3 hover:text-neg"><X className="h-3.5 w-3.5" /></button>}
          </span>
        ))}
        {!people.length && <p className="text-sm text-ink-3">Zatím bez účastníků – přidejte je a aplikace spočítá, kdo komu kolik dluží.</p>}
      </div>
      {edit && (
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run(() => addTripPerson(tripId, name), () => setName("")); }}>
          <input className="field !h-10 min-w-0 flex-1" placeholder="Jméno účastníka" aria-label="Jméno účastníka" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <Button type="submit" size="sm" variant="secondary" loading={pending} icon={<UserPlus className="h-4 w-4" />}>Přidat</Button>
          <Button type="button" size="sm" variant="ghost" icon={<Users className="h-4 w-4" />} onClick={() => run(() => addMembersToTrip(tripId))}>Členy domácnosti</Button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hotovost v cizí měně

function CashForm({ trip, kind, onDone }: { trip: Trip; kind: "buy" | "return"; onDone: () => void }) {
  const lk = useLookups();
  const [currency, setCurrency] = useState(trip.currency !== "CZK" ? trip.currency : "EUR");
  const [day, setDay] = useState(lk.today);
  const [rate, setRate] = useState("");
  const [orig, setOrig] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [record, setRecord] = useState(true);
  const { state, formAction, pending, fe } = useFormAction(saveCashMove, onDone);
  const load = (c: string, d: string) => getExchangeRate(c, d).then((r) => {
    if (r) { setRate(String(Number(r.rate.toFixed(4))).replace(".", ",")); setInfo(`kurz ČNB – směnárna bývá horší, upravte podle dokladu`); }
    else setInfo("kurz ČNB se nepodařilo načíst – zadejte ho podle dokladu");
  });
  const czk = parseMoney(orig) != null && Number(rate.replace(",", ".")) > 0 ? Math.round((parseMoney(orig) ?? 0) * Number(rate.replace(",", "."))) : null;
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="trip_id" value={trip.id} />
      <input type="hidden" name="kind" value={kind} />
      <p className="text-sm text-ink-2">{kind === "buy" ? "Výměna peněz nebo výběr z bankomatu. Z účtu se odečte jednou – hotovostní platby pak jdou z této peněženky a znovu se neodečítají." : "Zbylou hotovost jste vyměnili zpět na koruny."}</p>
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <Select name="currency" label="Měna" value={currency} onChange={(e) => { setCurrency(e.target.value); void load(e.target.value, day); }}>
          {CURRENCIES.filter((c) => c !== "CZK").map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <MoneyInput name="amount_original" label={`Částka (${currency})`} value={orig} onChange={(e) => setOrig(e.target.value)} error={fe("amount_original")} required autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="rate" label={`Kurz (Kč za 1 ${currency})`} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} onFocus={() => { if (!rate) void load(currency, day); }} error={fe("rate")} hint={info ?? "klikněte – načte se kurz ČNB"} />
        <Input name="date" type="date" label="Datum" value={day} onChange={(e) => setDay(e.target.value)} error={fe("date")} />
      </div>
      {czk != null && <p className="text-sm">= <b>{formatMoney(czk)}</b></p>}
      <Toggle name="record_tx" label={kind === "buy" ? "Odečíst z účtu (zapsat do výdajů)" : "Připsat na účet (zapsat do příjmů)"} checked={record} onChange={(e) => setRecord(e.target.checked)} />
      {record && <Select name="account_id" label={kind === "buy" ? "Z účtu" : "Na účet"} defaultValue={lk.accounts.find((a) => a.include_in_available)?.id} error={fe("account_id")}><AccountOptions /></Select>}
      <Textarea name="note" label="Poznámka" placeholder="např. směnárna na letišti" />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel="Zapsat" />
    </form>
  );
}

export function CashButton({ trip, kind, label, variant = "secondary" }: { trip: Trip; kind: "buy" | "return"; label: string; variant?: "primary" | "secondary" | "ghost" }) {
  return <ModalButton label={label} size="sm" variant={variant} icon={<Plus className="h-4 w-4" />} title={kind === "buy" ? "Hotovost v cizí měně" : "Vrácení zbytku hotovosti"} render={(close) => <CashForm trip={trip} kind={kind} onDone={close} />} />;
}

export function DeleteCashButton({ id, linked }: { id: string; linked: boolean }) {
  return <ActionButton action={() => deleteCashMove(id)} confirm={linked ? "Smazat? Propojená platba na účtu se stornuje." : "Smazat?"} size="icon" icon={<Trash2 className="h-4 w-4" />} />;
}

// ---------------------------------------------------------------------------
// Co vyřídit a sbalit

export function Checklist({ tripId, items, edit }: { tripId: string; items: TripChecklistItem[]; edit: boolean }) {
  const [opt, setOpt] = useOptimistic(items, (cur, u: { id: string; done: boolean }) => cur.map((i) => (i.id === u.id ? { ...i, done: u.done } : i)));
  const [text, setText] = useState("");
  const [, start] = useTransition();
  const { pending, run } = useRun();
  const groups = [...new Set(opt.map((i) => i.category ?? "Ostatní"))];
  const doneCount = opt.filter((i) => i.done).length;
  return (
    <div>
      {opt.length > 0 && <p className="mb-2 text-xs text-ink-3">Hotovo {doneCount} z {opt.length}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-3">{g}</p>
            <ul className="space-y-1">
              {opt.filter((i) => (i.category ?? "Ostatní") === g).map((i) => (
                <li key={i.id} className="group flex items-center gap-2 text-sm">
                  <button type="button" disabled={!edit} aria-pressed={i.done} aria-label={i.text} onClick={() => start(async () => { setOpt({ id: i.id, done: !i.done }); await toggleChecklistItem(i.id, !i.done); })}
                    className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", i.done ? "border-pos bg-pos/20 text-pos" : "border-white/20")}>
                    {i.done && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <span className={cn("flex-1", i.done && "text-ink-3 line-through")}>{i.text}</span>
                  {edit && <button type="button" aria-label="Smazat" onClick={() => run(() => deleteChecklistItem(i.id))} className="text-ink-3 opacity-0 hover:text-neg group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {edit && (
        <div className="mt-3 flex flex-wrap gap-2">
          <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) run(() => addChecklistItem(tripId, text), () => setText("")); }}>
            <input className="field !h-10 min-w-0 flex-1" placeholder="Přidat položku…" aria-label="Nová položka seznamu" value={text} onChange={(e) => setText(e.target.value)} maxLength={120} />
            <Button type="submit" size="sm" variant="secondary" loading={pending} icon={<Plus className="h-4 w-4" />}>Přidat</Button>
          </form>
          <Button type="button" size="sm" variant="ghost" icon={<Sparkles className="h-4 w-4" />} onClick={() => run(() => fillChecklist(tripId))}>Doplnit podle typu cesty</Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Program po dnech

function PlanForm({ trip, initial, onDone }: { trip: Trip; initial?: TripPlanItem; onDone: () => void }) {
  const [kind, setKind] = useState<TripPlanItem["kind"]>(initial?.kind ?? "stay");
  const { state, formAction, pending, fe } = useFormAction(savePlanItem, onDone);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="trip_id" value={trip.id} />
      <input type="hidden" name="kind" value={kind} />
      <div className="flex rounded-full border border-white/[0.08] bg-white/[0.05] p-1">
        {([["stay", "Ubytování"], ["activity", "Program"], ["note", "Poznámka"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`flex-1 rounded-full px-3 py-1.5 text-sm ${kind === k ? "bg-ink font-medium text-base" : "text-ink-2"}`}>{l}</button>)}
      </div>
      <Input name="title" label={kind === "stay" ? "Ubytování" : kind === "activity" ? "Co" : "Poznámka"} placeholder={kind === "stay" ? "Apartmán Ivana" : kind === "activity" ? "Výlet lodí na Hvar" : "Vyzvednout klíče u sousedky"} defaultValue={initial?.title} error={fe("title")} required autoFocus />
      <div className="grid grid-cols-[1fr_1fr_6rem] gap-3">
        <Input name="date" type="date" label={kind === "stay" ? "Příjezd" : "Den"} defaultValue={initial?.date ?? trip.start_date ?? ""} error={fe("date")} />
        {kind === "stay" ? <Input name="end_date" type="date" label="Odjezd" defaultValue={initial?.end_date ?? trip.end_date ?? ""} error={fe("end_date")} /> : <span />}
        <Input name="time" type="time" label={kind === "stay" ? "Check-in" : "Čas"} defaultValue={initial?.time ?? ""} error={fe("time")} />
      </div>
      <Input name="address" label="Adresa" placeholder="ulice, město" defaultValue={initial?.address ?? ""} error={fe("address")} />
      <Input name="url" label="Odkaz" placeholder="https:// (rezervace, web)" defaultValue={initial?.url ?? ""} error={fe("url")} />
      <Textarea name="note" label="Poznámka" placeholder="kód ke dveřím, kontakt…" defaultValue={initial?.note ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel={initial ? "Uložit" : "Přidat"} />
    </form>
  );
}

export function PlanButton({ trip, initial, label }: { trip: Trip; initial?: TripPlanItem; label?: string }) {
  return <ModalButton label={label} size={initial ? "icon" : "sm"} variant={initial ? "ghost" : "secondary"} icon={initial ? <FileText className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit" : "Do programu"} render={(close) => <PlanForm trip={trip} initial={initial} onDone={close} />} />;
}

export function DeletePlanButton({ id }: { id: string }) {
  return <ActionButton action={() => deletePlanItem(id)} confirm="Smazat z programu?" size="icon" icon={<Trash2 className="h-4 w-4" />} />;
}

// ---------------------------------------------------------------------------
// Dokumenty cesty

export function TripDocUpload({ tripId }: { tripId: string }) {
  const lk = useLookups();
  const { run } = useRun();
  const [busy, setBusy] = useState(false);
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-sm text-ink-2 hover:border-gold/50 hover:text-ink">
      <Plus className="h-4 w-4" />
      <span>{busy ? "Nahrávám…" : "Přidat dokument (rezervace, pojištění, jízdenka…)"}</span>
      <input type="file" accept="application/pdf,image/*" className="sr-only" disabled={busy} onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setBusy(true);
        try {
          const id = await uploadDocument(f, "other", lk);
          run(() => attachDocumentToTrip(tripId, id));
        } catch (err) {
          alert(err instanceof Error ? err.message : "Nahrání selhalo");
        } finally {
          setBusy(false);
          e.target.value = "";
        }
      }} />
    </label>
  );
}

export function DetachDocButton({ id }: { id: string }) {
  return <ActionButton action={() => detachDocumentFromTrip(id)} confirm="Odebrat dokument z cesty? (V Dokumentech zůstane.)" size="icon" icon={<X className="h-4 w-4" />} />;
}

// ---------------------------------------------------------------------------
// Kopie cesty, cíl ve Spoření, hromadné přiřazení

function DuplicateForm({ trip, onDone }: { trip: Trip; onDone: () => void }) {
  const router = useRouter();
  const { state, formAction, pending, fe } = useFormAction(duplicateTrip, (r) => { onDone(); if (r.id) router.push(`/cestovani/${r.id}`); });
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={trip.id} />
      <p className="text-sm text-ink-2">Zkopíruje se trasa a dopravci, účastníci, program, seznam věcí a ubytování jako naplánovaný výdaj. Data se posunou podle nového odjezdu.</p>
      <Input name="name" label="Název nové cesty" defaultValue={`${trip.name} (znovu)`.slice(0, 120)} error={fe("name")} required />
      <Input name="start_date" type="date" label="Nový odjezd" error={fe("start_date")} hint="nevyplněno = zatím bez termínu" />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel="Zkopírovat" />
    </form>
  );
}

export function DuplicateTripButton({ trip }: { trip: Trip }) {
  return <ModalButton label="Kopie" size="md" variant="ghost" icon={<Copy className="h-4 w-4" />} title="Nová cesta podle této" render={(close) => <DuplicateForm trip={trip} onDone={close} />} />;
}

export function GoalButton({ tripId, linked }: { tripId: string; linked: boolean }) {
  return linked
    ? <ActionButton action={() => unlinkGoal(tripId)} confirm="Odpojit cíl? Rezervu na cestu bude znovu počítat plánovač." size="sm">Odpojit cíl</ActionButton>
    : <ActionButton action={() => createGoalForTrip(tripId)} size="sm" variant="secondary" icon={<PiggyBank className="h-4 w-4" />}>Založit cíl ve Spoření</ActionButton>;
}

export function LinkSuggestedButton({ tripId, count }: { tripId: string; count: number }) {
  return <ActionButton action={() => linkSuggestedTransactions(tripId)} size="sm" variant="primary" icon={<Link2 className="h-4 w-4" />}>Přiřadit navržené ({count})</ActionButton>;
}
