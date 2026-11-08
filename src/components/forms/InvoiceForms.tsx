"use client";
import { CheckCircle2, Pencil, Plus, ScanText, Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { payInvoice, saveInvoice } from "@/lib/actions/invoices";
import { formatMoney, toInputValue } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { Invoice, Transaction } from "@/lib/db/types";
import { extractInvoice, type ExtractedInvoice } from "@/lib/invoice-parse";
import { recognizeText } from "@/lib/ocr-client";
import { saveOcrText } from "@/lib/actions/documents";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, MoneyInput, Segmented, Select, Textarea, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { Badge } from "@/components/ui/Badge";
import { AccountOptions, AttachDocument, FormActions } from "./common";
import { cn } from "@/components/ui/cn";

type Vals = { number: string; counterparty: string; counterparty_ico: string; issue_date: string; due_date: string; amount: string };

/**
 * Formulář faktury s volitelným OCR. Rozpoznané hodnoty jsou jen návrh:
 * pole jsou zvýrazněná, uživatel je musí zkontrolovat a potvrdit – bez potvrzení
 * server uložení odmítne.
 */
export function InvoiceForm({ initial, onDone }: { initial?: Invoice; onDone?: () => void }) {
  const lk = useLookups();
  const [direction, setDirection] = useState<Invoice["direction"]>(initial?.direction ?? "received");
  const [vals, setVals] = useState<Vals>({
    number: initial?.number ?? "", counterparty: initial?.counterparty ?? "", counterparty_ico: initial?.counterparty_ico ?? "",
    issue_date: initial?.issue_date ?? lk.today, due_date: initial?.due_date ?? "", amount: toInputValue(initial?.amount ?? null),
  });
  const [ocr, setOcr] = useState<{ fields: ExtractedInvoice; used: boolean } | null>(null);
  const [ocrState, setOcrState] = useState<{ busy: boolean; label?: string; progress?: number; error?: string }>({ busy: false });
  const { state, formAction, pending, fe } = useFormAction(saveInvoice, onDone);
  const set = (k: keyof Vals) => (e: React.ChangeEvent<HTMLInputElement>) => setVals((s) => ({ ...s, [k]: e.target.value }));

  async function runOcr(file: File, documentId?: string) {
    setOcrState({ busy: true, label: "Připravuji…", progress: 0 });
    try {
      const text = await recognizeText(file, (p, label) => setOcrState({ busy: true, progress: p, label }));
      const f = extractInvoice(text, lk.ownIco);
      setOcr({ fields: f, used: true });
      setVals((s) => ({
        number: f.number.value ?? s.number,
        counterparty: f.counterparty.value ?? s.counterparty,
        counterparty_ico: f.counterpartyIco.value ?? s.counterparty_ico,
        issue_date: f.issueDate.value ?? s.issue_date,
        due_date: f.dueDate.value ?? s.due_date,
        amount: f.amount.value != null ? toInputValue(f.amount.value) : s.amount,
      }));
      if (documentId) await saveOcrText(documentId, text);
      setOcrState({ busy: false });
    } catch (e) {
      setOcrState({ busy: false, error: `Rozpoznání se nepovedlo (${e instanceof Error ? e.message : "chyba"}). Údaje vyplňte ručně.` });
    }
  }

  const conf = (k: keyof ExtractedInvoice) => ocr?.fields[k]?.confidence;
  const hl = (k: keyof ExtractedInvoice) => {
    const c = conf(k);
    return c === "high" ? "ring-1 ring-gold/50 rounded-[0.875rem]" : c === "low" ? "ring-1 ring-warn/70 rounded-[0.875rem]" : c === "none" ? "ring-1 ring-neg/50 rounded-[0.875rem]" : "";
  };

  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="ocr_used" value={ocr?.used ? "on" : ""} />
      <Segmented name="direction" value={direction} onChange={setDirection} options={[{ value: "received", label: "Přijatá (platím)" }, { value: "issued", label: "Vystavená (dostanu)" }]} />

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <AttachDocument
          kind="invoice"
          label="PDF nebo fotografie faktury"
          initialId={initial?.document_id}
          onFile={(f, id) => { if (lk.premium) void runOcr(f, id); }}
        />
        {ocrState.busy && (
          <div className="mt-2 flex items-center gap-2 text-xs text-ink-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {ocrState.label} {ocrState.progress != null && `${Math.round(ocrState.progress * 100)} %`}
          </div>
        )}
        {ocrState.error && <p className="mt-2 text-xs text-warn">{ocrState.error}</p>}
        {!ocr && !ocrState.busy && (lk.premium
          ? <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3"><ScanText className="h-3.5 w-3.5" /> Po nahrání se údaje pokusíme rozpoznat (OCR). Vždy je zkontrolujte.</p>
          : <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3"><ScanText className="h-3.5 w-3.5" /> Automatické čtení údajů z faktury je součást <a href="/premium" className="text-gold underline">Premium</a>. Údaje vyplňte ručně.</p>)}
        {ocr && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
            <Badge tone="gold">rozpoznáno</Badge><Badge tone="warning">nejisté</Badge><Badge tone="danger">nenalezeno</Badge>
            <span>– zkontrolujte zvýrazněná pole</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={hl("number")}><Input name="number" label="Číslo faktury" value={vals.number} onChange={set("number")} error={fe("number")} required /></div>
        <div className={hl("amount")}><MoneyInput name="amount" label="Částka celkem" value={vals.amount} onChange={set("amount")} error={fe("amount")} required /></div>
      </div>
      <div className="grid grid-cols-[1fr_9rem] gap-3">
        <div className={hl("counterparty")}><Input name="counterparty" label={direction === "received" ? "Dodavatel" : "Odběratel"} value={vals.counterparty} onChange={set("counterparty")} error={fe("counterparty")} required /></div>
        <div className={hl("counterpartyIco")}><Input name="counterparty_ico" label="IČO" inputMode="numeric" value={vals.counterparty_ico} onChange={set("counterparty_ico")} error={fe("counterparty_ico")} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className={hl("issueDate")}><Input name="issue_date" type="date" label="Datum vystavení" value={vals.issue_date} onChange={set("issue_date")} error={fe("issue_date")} required /></div>
        <div className={hl("dueDate")}><Input name="due_date" type="date" label="Datum splatnosti" value={vals.due_date} onChange={set("due_date")} error={fe("due_date")} /></div>
      </div>
      <Textarea name="note" label="Poznámka" defaultValue={initial?.note ?? ""} />
      {initial && <Toggle name="include_in_plan" label="Započítat do finančního plánu" defaultChecked={initial.include_in_plan} />}
      {ocr?.used && (
        <div className={cn("rounded-xl border px-3 py-2", fe("ocr_confirmed") ? "border-neg/50 bg-neg/10" : "border-gold/30 bg-gold/10")}>
          <Toggle name="ocr_confirmed" label="Zkontroloval(a) jsem rozpoznané údaje a jsou správné" description="Bez potvrzení se faktura neuloží." error={fe("ocr_confirmed")} />
        </div>
      )}
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel={initial ? "Uložit změny" : "Uložit fakturu"} />
    </form>
  );
}

export function InvoiceButton({ initial, label, variant = "secondary", size = "sm" }: { initial?: Invoice; label?: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "icon" }) {
  return <ModalButton label={label} variant={variant} size={size} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit fakturu" : "Nová faktura"} render={(close) => <InvoiceForm initial={initial} onDone={close} />} />;
}

export function PayInvoiceButton({ invoice, candidates }: { invoice: Invoice; candidates: Transaction[] }) {
  return <ModalButton label="Zaplaceno" size="sm" variant="secondary" icon={<CheckCircle2 className="h-4 w-4" />} title={`Úhrada faktury ${invoice.number}`} render={(close) => <PayInvoiceForm invoice={invoice} candidates={candidates} onDone={close} />} />;
}

function PayInvoiceForm({ invoice, candidates, onDone }: { invoice: Invoice; candidates: Transaction[]; onDone: () => void }) {
  const lk = useLookups();
  const matching = candidates.filter((t) => t.amount === invoice.amount && t.type === (invoice.direction === "issued" ? "income" : "expense"));
  const [mode, setMode] = useState<"create" | "link" | "none">(matching.length ? "link" : "create");
  const { state, formAction, pending, fe } = useFormAction(payInvoice, onDone);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={invoice.id} />
      <p className="text-sm text-ink-2">{invoice.counterparty} · <b className="text-ink">{formatMoney(invoice.amount)}</b></p>
      <Input name="paid_date" type="date" label="Datum úhrady" defaultValue={lk.today} error={fe("paid_date")} required />
      <Select name="mode" label="Platba v evidenci" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
        <option value="create">Zapsat novou platbu na účet</option>
        <option value="link">Propojit s existující transakcí (např. z banky)</option>
        <option value="none">Nezapisovat (platba proběhla mimo sledované účty)</option>
      </Select>
      {mode === "create" && <Select name="account_id" label="Účet" error={fe("account_id")} defaultValue={lk.accounts.find((a) => a.include_in_available)?.id}><AccountOptions /></Select>}
      {mode === "link" && (
        candidates.length ? (
          <Select name="transaction_id" label="Transakce" error={fe("transaction_id")} defaultValue={matching[0]?.id}>
            <option value="">— vyberte —</option>
            {(matching.length ? matching : candidates).map((t) => <option key={t.id} value={t.id}>{formatDate(t.date)} · {formatMoney(t.amount)} · {t.description}</option>)}
          </Select>
        ) : <p className="flex items-center gap-2 text-sm text-warn"><AlertTriangle className="h-4 w-4" /> Žádná vhodná nepropojená transakce.</p>
      )}
      <p className="text-xs text-ink-3">Propojením s existující platbou zabráníte jejímu dvojímu započtení.</p>
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel="Označit jako zaplacenou" />
    </form>
  );
}
