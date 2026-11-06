"use client";
import { Banknote, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { receivePayout, savePayout, saveShift, saveWorkSettings } from "@/lib/actions/work";
import { formatMoney, parseMoney, toInputValue } from "@/lib/money";
import type { Invoice, Payout, WorkShift } from "@/lib/db/types";
import { privateKmCost, suggestBaseEarnings } from "@/lib/finance/work";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, MoneyInput, Select, Textarea, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { Button } from "@/components/ui/Button";
import { AccountOptions, FormActions, MemberOptions } from "./common";

const fmtDuration = (m: number) => (m ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` : "");

function parseDur(s: string): number {
  const hm = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (hm) return +hm[1] * 60 + +hm[2];
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 60) : 0;
}

export function ShiftForm({ initial, onDone }: { initial?: WorkShift; onDone?: () => void }) {
  const lk = useLookups();
  const ws = lk.workSettings;
  const [v, setV] = useState({
    minutes: fmtDuration(initial?.minutes ?? 0), peak: fmtDuration(initial?.peak_minutes ?? 0),
    reg: String(initial?.regular_routes ?? ""), exp: String(initial?.express_routes ?? ""), orders: String(initial?.orders ?? ""),
    base: toInputValue(initial?.base_earnings ?? null), km: initial?.private_km && initial.private_km !== "0" ? initial.private_km : "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const suggestion = useMemo(() => {
    if (!ws) return 0;
    return suggestBaseEarnings(ws, { minutes: parseDur(v.minutes), peak_minutes: parseDur(v.peak), regular_routes: +v.reg || 0, express_routes: +v.exp || 0, orders: +v.orders || 0 });
  }, [ws, v]);
  const kmCost = useMemo(() => { try { return privateKmCost(ws?.private_km_rate ?? 0, v.km.replace(",", ".") || "0"); } catch { return 0; } }, [ws, v.km]);
  const { state, formAction, pending, fe } = useFormAction(saveShift, onDone);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Input name="date" type="date" label="Datum" defaultValue={initial?.date ?? lk.today} error={fe("date")} required />
        <Select name="member_id" label="Kdo" defaultValue={initial?.member_id ?? ws?.member_id ?? ""}><MemberOptions includeEmpty="—" /></Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="minutes" label="Odpracováno" placeholder="7:30" value={v.minutes} onChange={set("minutes")} error={fe("minutes")} inputMode="decimal" />
        <Input name="peak_minutes" label="Z toho ve špičce" placeholder="2:00" value={v.peak} onChange={set("peak")} error={fe("peak_minutes")} inputMode="decimal" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input name="regular_routes" label="Běžné trasy" inputMode="numeric" value={v.reg} onChange={set("reg")} error={fe("regular_routes")} />
        <Input name="express_routes" label="Expresní" inputMode="numeric" value={v.exp} onChange={set("exp")} error={fe("express_routes")} />
        <Input name="orders" label="Objednávky" inputMode="numeric" value={v.orders} onChange={set("orders")} error={fe("orders")} />
      </div>
      <div>
        <MoneyInput name="base_earnings" label="Základní výdělek" value={v.base} onChange={set("base")} error={fe("base_earnings")} />
        {suggestion > 0 && (
          <button type="button" className="mt-1 text-xs text-gold hover:underline" onClick={() => setV((s) => ({ ...s, base: toInputValue(suggestion) }))}>
            Podle sazeb: {formatMoney(suggestion)} – použít
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <MoneyInput name="tips" label="Spropitné" defaultValue={toInputValue(initial?.tips || null)} error={fe("tips")} />
        <MoneyInput name="bonuses" label="Bonusy" defaultValue={toInputValue(initial?.bonuses || null)} error={fe("bonuses")} />
        <MoneyInput name="rewards" label="Odměny" defaultValue={toInputValue(initial?.rewards || null)} error={fe("rewards")} />
      </div>
      <p className="pt-1 text-xs font-medium uppercase tracking-wider text-ink-3">Náklady a srážky</p>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="vehicle_rent" label="Pronájem vozidla" defaultValue={toInputValue(initial ? initial.vehicle_rent || null : ws?.default_vehicle_rent || null)} error={fe("vehicle_rent")} />
        <MoneyInput name="equipment_cost" label="Vybavení" defaultValue={toInputValue(initial?.equipment_cost || null)} error={fe("equipment_cost")} />
        <div>
          <Input name="private_km" label="Soukromé km" placeholder="0" inputMode="decimal" value={v.km} onChange={set("km")} error={fe("private_km")} />
          {kmCost > 0 && <p className="mt-1 text-xs text-ink-3">Náklad {formatMoney(kmCost)}</p>}
        </div>
        <MoneyInput name="other_deductions" label="Ostatní srážky" defaultValue={toInputValue(initial?.other_deductions || null)} error={fe("other_deductions")} />
      </div>
      <Textarea name="note" label="Poznámka" defaultValue={initial?.note ?? ""} />
      <p className="text-xs text-ink-3">Směny jsou evidence práce. Do peněz domácnosti se výdělek promítne až přijetím výplaty (nic se nezapočte dvakrát).</p>
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}

export function ShiftButton({ initial, label, variant = "secondary", size = "sm" }: { initial?: WorkShift; label?: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "icon" }) {
  return <ModalButton label={label} variant={variant} size={size} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit směnu" : "Nová směna"} render={(close) => <ShiftForm initial={initial} onDone={close} />} />;
}

export function PayoutForm({ initial, invoices = [], onDone }: { initial?: Payout; invoices?: Invoice[]; onDone?: () => void }) {
  const lk = useLookups();
  const { state, formAction, pending, fe } = useFormAction(savePayout, onDone);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Input name="label" label="Označení" placeholder="např. Výplata Rohlík – říjen" defaultValue={initial?.label} error={fe("label")} required autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Input name="period_from" type="date" label="Období od" defaultValue={initial?.period_from ?? ""} error={fe("period_from")} />
        <Input name="period_to" type="date" label="Období do" defaultValue={initial?.period_to ?? ""} error={fe("period_to")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="expected_amount" label="Očekávaná částka" defaultValue={toInputValue(initial?.expected_amount)} error={fe("expected_amount")} required />
        <Input name="expected_date" type="date" label="Očekávané datum" defaultValue={initial?.expected_date ?? lk.today} error={fe("expected_date")} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select name="account_id" label="Na účet" defaultValue={initial?.account_id ?? ""}><AccountOptions includeEmpty="— vyberte —" /></Select>
        <Select name="member_id" label="Kdo" defaultValue={initial?.member_id ?? lk.workSettings?.member_id ?? ""}><MemberOptions includeEmpty="—" /></Select>
      </div>
      {invoices.length > 0 && (
        <Select name="invoice_id" label="Vystavená faktura" hint="zabrání dvojímu započtení" defaultValue={initial?.invoice_id ?? ""}>
          <option value="">— bez faktury —</option>
          {invoices.map((i) => <option key={i.id} value={i.id}>{i.number} · {formatMoney(i.amount)}</option>)}
        </Select>
      )}
      <Textarea name="note" label="Poznámka" defaultValue={initial?.note ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}

export function PayoutButton({ initial, invoices, label, variant = "secondary", size = "sm", suggestedAmount }: { initial?: Payout; invoices?: Invoice[]; label?: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "icon"; suggestedAmount?: number }) {
  void suggestedAmount;
  return <ModalButton label={label} variant={variant} size={size} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit výplatu" : "Očekávaná výplata"} render={(close) => <PayoutForm initial={initial} invoices={invoices} onDone={close} />} />;
}

export function ReceivePayoutButton({ payout }: { payout: Payout }) {
  return (
    <ModalButton label="Přijato" size="sm" variant="secondary" icon={<Banknote className="h-4 w-4" />} title={`Přijetí: ${payout.label}`}
      render={(close) => <ReceivePayoutForm payout={payout} onDone={close} />} />
  );
}

function ReceivePayoutForm({ payout, onDone }: { payout: Payout; onDone: () => void }) {
  const lk = useLookups();
  const [amount, setAmount] = useState(toInputValue(payout.expected_amount));
  const parsed = parseMoney(amount);
  const { state, formAction, pending, fe } = useFormAction(receivePayout, onDone);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={payout.id} />
      <p className="text-sm text-ink-2">Očekáváno {formatMoney(payout.expected_amount)}{parsed != null && parsed !== payout.expected_amount && <> · rozdíl <b className={parsed > payout.expected_amount ? "text-pos" : "text-neg"}>{formatMoney(parsed - payout.expected_amount, { sign: true })}</b></>}</p>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="received_amount" label="Skutečně přijato" value={amount} onChange={(e) => setAmount(e.target.value)} error={fe("received_amount")} required />
        <Input name="received_date" type="date" label="Datum přijetí" defaultValue={lk.today} error={fe("received_date")} required />
      </div>
      <Select name="account_id" label="Na účet" defaultValue={payout.account_id ?? lk.accounts.find((a) => a.include_in_available)?.id} error={fe("account_id")}><AccountOptions /></Select>
      <Toggle name="create_transaction" label="Zapsat jako příjem na účet" description="Vypněte, pokud už platbu máte v transakcích (např. z importu banky)" defaultChecked />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel="Potvrdit přijetí" />
    </form>
  );
}

export function WorkSettingsForm() {
  const lk = useLookups();
  const ws = lk.workSettings;
  const { state, formAction, pending, fe } = useFormAction(saveWorkSettings);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="company" label="Firma" defaultValue={ws?.company ?? "Rohlík"} error={fe("company")} />
        <Select name="member_id" label="Kdo pracuje" defaultValue={ws?.member_id ?? ""}><MemberOptions includeEmpty="—" /></Select>
      </div>
      <p className="text-xs text-ink-3">Sazby slouží jen k návrhu výdělku u směny – skutečnou částku vždy můžete přepsat. Nevyplněné sazby se nepoužijí.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MoneyInput name="rate_hour" label="Za hodinu" defaultValue={toInputValue(ws?.rate_hour || null)} error={fe("rate_hour")} />
        <MoneyInput name="rate_peak_hour_bonus" label="Příplatek špička/h" defaultValue={toInputValue(ws?.rate_peak_hour_bonus || null)} error={fe("rate_peak_hour_bonus")} />
        <MoneyInput name="rate_regular_route" label="Běžná trasa" defaultValue={toInputValue(ws?.rate_regular_route || null)} error={fe("rate_regular_route")} />
        <MoneyInput name="rate_express_route" label="Expresní trasa" defaultValue={toInputValue(ws?.rate_express_route || null)} error={fe("rate_express_route")} />
        <MoneyInput name="rate_order" label="Za objednávku" defaultValue={toInputValue(ws?.rate_order || null)} error={fe("rate_order")} />
        <MoneyInput name="private_km_rate" label="Soukromý km" defaultValue={toInputValue(ws?.private_km_rate || null)} error={fe("private_km_rate")} />
        <MoneyInput name="default_vehicle_rent" label="Pronájem vozu/den" defaultValue={toInputValue(ws?.default_vehicle_rent || null)} error={fe("default_vehicle_rent")} />
      </div>
      <FormError error={state.ok ? undefined : state.error} />
      <div className="flex justify-end"><Button type="submit" variant="primary" loading={pending}>Uložit nastavení práce</Button></div>
    </form>
  );
}
