import { Ban, CalendarClock, Download, Paperclip, RotateCcw, Trash2 } from "lucide-react";
import { requireContext } from "@/lib/context";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { IcoLocked } from "@/components/ui/IcoLocked";
import { loadData } from "@/lib/data";
import { addDays, diffDays, formatDate, todayISO } from "@/lib/dates";
import { sum } from "@/lib/money";
import { invoiceStatusLabel, isInvoiceOverdue } from "@/lib/finance/obligations";
import { deleteInvoice, setInvoiceStatus, toggleInvoicePlan } from "@/lib/actions/invoices";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge, type Tone } from "@/components/ui/Badge";
import { ActionButton } from "@/components/ui/ActionButton";
import { LinkButton } from "@/components/ui/Button";
import { FilterSearch, FilterSelect, FilterTabs } from "@/components/lists/Filters";
import { InvoiceButton, PayInvoiceButton } from "@/components/forms/InvoiceForms";

export const metadata = { title: "Faktury" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const data = await loadData(ctx);
  if (!(data.settings?.billing_ico && data.settings.ico_activated_at)) {
    return (
      <div className="space-y-4">
        <PageHeader title={"Faktury"} subtitle="Pro podnikání na IČO" />
        <IcoLocked what="Sekce Faktury" />
      </div>
    );
  }
  const today = todayISO();
  const q = (sp.q ?? "").toLowerCase();
  const stav = sp.stav ?? "";
  const filtered = data.invoices.filter((i) =>
    (!sp.druh || i.direction === sp.druh) &&
    (stav === "" ? true : stav === "nezaplacene" ? i.status === "unpaid" : stav === "po-splatnosti" ? isInvoiceOverdue(i, today) : stav === "zaplacene" ? i.status === "paid" : i.status === "cancelled") &&
    (!q || `${i.number} ${i.counterparty} ${i.counterparty_ico ?? ""} ${i.note ?? ""}`.toLowerCase().includes(q)) &&
    (!sp.rok || i.issue_date.startsWith(sp.rok)),
  );
  const count = (f: (i: (typeof data.invoices)[number]) => boolean) => data.invoices.filter(f).length;
  const unpaid = data.invoices.filter((i) => i.status === "unpaid");
  const due = unpaid.filter((i) => i.due_date && i.due_date <= addDays(today, 30)).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const linkedTx = new Set(data.transactions.map((t) => t.invoice_id).filter(Boolean));
  const years = [...new Set(data.invoices.map((i) => i.issue_date.slice(0, 4)))].sort().reverse();
  const tone = (i: (typeof data.invoices)[number]): Tone => i.status === "paid" ? "positive" : i.status === "cancelled" ? "neutral" : isInvoiceOverdue(i, today) ? "danger" : "warning";

  return (
    <div className="space-y-4">
      <ReadOnlyNotice ctx={ctx} section="invoices" />
      <PageHeader title="Faktury" subtitle="Vystavené i přijaté faktury s archivem dokumentů. OCR údaje se ukládají až po vašem potvrzení."
        actions={<><LinkButton href="/dane">Daně OSVČ</LinkButton><LinkButton href="/api/export/faktury" icon={<Download className="h-4 w-4" />}>Export CSV</LinkButton><InvoiceButton label="Nová faktura" variant="primary" size="md" /></>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Dostanu (nezaplacené vystavené)</p><Money value={sum(unpaid.filter((i) => i.direction === "issued"), (i) => i.amount)} decimals="never" className="text-xl font-semibold text-pos" /></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Zaplatím (nezaplacené přijaté)</p><Money value={sum(unpaid.filter((i) => i.direction === "received"), (i) => i.amount)} decimals="never" className="text-xl font-semibold" /></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Po splatnosti</p><p className="num text-xl font-semibold text-neg">{count((i) => isInvoiceOverdue(i, today))}</p></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Zaplaceno letos</p><Money value={sum(data.invoices.filter((i) => i.status === "paid" && (i.paid_date ?? "").startsWith(today.slice(0, 4))), (i) => i.amount)} decimals="never" className="text-xl font-semibold" /></Card>
      </div>

      {due.length > 0 && (
        <Card title="Přehled splatností" subtitle="Nezaplacené faktury po splatnosti a splatné do 30 dní">
          <div className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {due.map((i) => {
              const d = diffDays(today, i.due_date!);
              return (
                <div key={i.id} className={`min-w-48 rounded-2xl border p-3 ${d < 0 ? "border-neg/30 bg-neg/10" : d <= 7 ? "border-warn/30 bg-warn/10" : "border-white/10 bg-white/[0.03]"}`}>
                  <p className="flex items-center gap-1.5 text-xs text-ink-2"><CalendarClock className="h-3.5 w-3.5" />{d < 0 ? `${-d} dní po splatnosti` : d === 0 ? "splatná dnes" : `za ${d} dní`}</p>
                  <p className="mt-1 truncate text-sm">{i.number} · {i.counterparty}</p>
                  <p className="text-xs text-ink-3">{i.direction === "issued" ? "dostanu" : "zaplatím"} · <Money value={i.amount} /></p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="!p-0">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-3 sm:p-4">
          <FilterTabs name="stav" options={[
            { value: "", label: "Vše", count: data.invoices.length },
            { value: "nezaplacene", label: "Nezaplacené", count: count((i) => i.status === "unpaid") },
            { value: "po-splatnosti", label: "Po splatnosti", count: count((i) => isInvoiceOverdue(i, today)) },
            { value: "zaplacene", label: "Zaplacené", count: count((i) => i.status === "paid") },
            { value: "stornovane", label: "Stornované", count: count((i) => i.status === "cancelled") },
          ]} />
          <div className="flex flex-wrap gap-2">
            <FilterSelect name="druh" label="Druh"><option value="">Vystavené i přijaté</option><option value="issued">Vystavené</option><option value="received">Přijaté</option></FilterSelect>
            <FilterSelect name="rok" label="Rok"><option value="">Všechny roky</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</FilterSelect>
            <FilterSearch placeholder="Číslo, firma, IČO…" />
          </div>
        </div>
        {filtered.length ? (
          <ul className="divide-y divide-white/[0.05]">
            {filtered.map((i) => {
              const candidates = data.transactions.filter((t) => t.status === "posted" && !linkedTx.has(t.id) && !t.invoice_id && t.type !== "transfer" && t.date >= addDays(i.issue_date, -5) && t.date <= addDays(today, 1)).slice(0, 40);
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 sm:px-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm">
                      <span className="truncate font-medium">{i.number}</span>
                      <Badge tone={i.direction === "issued" ? "gold" : "info"}>{i.direction === "issued" ? "vystavená" : "přijatá"}</Badge>
                      {i.document_id && <a href={`/api/files/${i.document_id}`} target="_blank" rel="noreferrer" className="text-gold" aria-label="Zobrazit dokument"><Paperclip className="h-3.5 w-3.5" /></a>}
                    </p>
                    <p className="truncate text-xs text-ink-2">{i.counterparty}{i.counterparty_ico && ` · IČO ${i.counterparty_ico}`}</p>
                    <p className="text-[11px] text-ink-3">vystaveno {formatDate(i.issue_date)} · splatnost {formatDate(i.due_date)}{i.paid_date && ` · uhrazeno ${formatDate(i.paid_date)}`}{!i.include_in_plan && i.status === "unpaid" && " · mimo plán"}{i.ocr_used && " · OCR potvrzeno"}</p>
                  </div>
                  <Badge tone={tone(i)}>{invoiceStatusLabel(i, today)}</Badge>
                  <Money value={i.amount} className={`w-28 text-right text-sm font-medium ${i.status === "cancelled" ? "line-through opacity-50" : ""}`} />
                  <div className="flex items-center">
                    {i.status === "unpaid" && <PayInvoiceButton invoice={i} candidates={candidates} />}
                    <InvoiceButton initial={i} size="icon" variant="ghost" />
                    {i.status === "unpaid" && <ActionButton action={toggleInvoicePlan.bind(null, i.id, !i.include_in_plan)} size="sm">{i.include_in_plan ? "Mimo plán" : "Do plánu"}</ActionButton>}
                    {i.status === "unpaid" && <ActionButton action={setInvoiceStatus.bind(null, i.id, "cancelled")} confirm="Stornovat fakturu?" size="icon" icon={<Ban className="h-4 w-4" />} />}
                    {i.status !== "unpaid" && <ActionButton action={setInvoiceStatus.bind(null, i.id, "unpaid")} confirm={i.status === "paid" ? "Vrátit mezi nezaplacené? Platba vytvořená z faktury bude stornována." : "Obnovit fakturu?"} size="icon" icon={<RotateCcw className="h-4 w-4" />} />}
                    <ActionButton action={deleteInvoice.bind(null, i.id)} confirm="Smazat fakturu? Dokument zůstane v archivu." size="icon" icon={<Trash2 className="h-4 w-4" />} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <div className="p-4"><EmptyState title="Žádné faktury" action={<InvoiceButton label="Přidat fakturu" variant="primary" />}>Nahrajte PDF nebo fotku – údaje se pokusíme rozpoznat a vy je jen zkontrolujete.</EmptyState></div>}
      </Card>
    </div>
  );
}
