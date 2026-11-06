import { Download, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { requireContext } from "@/lib/context";
import { loadData } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { DOCUMENT_KIND_LABEL } from "@/lib/defaults";
import { deleteDocument } from "@/lib/actions/documents";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ActionButton } from "@/components/ui/ActionButton";
import { FilterSearch, FilterTabs } from "@/components/lists/Filters";
import { EditDocumentButton, UploadDocumentButton } from "@/components/forms/DocumentForms";
import { Money } from "@/components/ui/Money";

export const metadata = { title: "Dokumenty" };

const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} kB`);

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const data = await loadData(ctx);
  const q = (sp.q ?? "").toLowerCase();
  const docs = data.documents.filter((d) => (!sp.druh || d.kind === sp.druh) && (!q || `${d.title} ${d.file_name} ${d.tags ?? ""} ${d.ocr_text ?? ""}`.toLowerCase().includes(q)));
  const count = (k: string) => data.documents.filter((d) => d.kind === k).length;
  return (
    <div className="space-y-4">
      <PageHeader title="Dokumenty" subtitle="Soukromý archiv faktur, účtenek a smluv – přístup mají jen členové domácnosti" actions={<UploadDocumentButton />} />
      <Card className="!p-0">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <FilterTabs name="druh" options={[{ value: "", label: "Vše", count: data.documents.length }, ...Object.entries(DOCUMENT_KIND_LABEL).map(([v, l]) => ({ value: v, label: l, count: count(v) }))]} />
          <FilterSearch placeholder="Hledat i v textu dokumentu…" />
        </div>
        {docs.length ? (
          <ul className="divide-y divide-white/[0.05]">
            {docs.map((d) => {
              const inv = data.invoices.find((i) => i.document_id === d.id);
              const tx = data.transactions.find((t) => t.document_id === d.id);
              const Icon = d.mime_type.startsWith("image/") ? ImageIcon : FileText;
              return (
                <li key={d.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-gold"><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <a href={`/api/files/${d.id}`} target="_blank" rel="noreferrer" className="block truncate text-sm hover:underline">{d.title}</a>
                    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
                      <Badge>{DOCUMENT_KIND_LABEL[d.kind]}</Badge>
                      <span>{formatDate(d.created_at.slice(0, 10))} · {size(d.size_bytes)}</span>
                      {inv && <span>· faktura {inv.number}</span>}
                      {tx && <span>· {tx.description} <Money value={tx.amount} /></span>}
                      {d.tags && <span>· {d.tags}</span>}
                      {d.ocr_text && <Badge tone="gold">text rozpoznán</Badge>}
                    </p>
                  </div>
                  <a href={`/api/files/${d.id}?stahnout=1`} className="rounded-full p-2 text-ink-3 hover:bg-white/10 hover:text-ink" aria-label="Stáhnout"><Download className="h-4 w-4" /></a>
                  <EditDocumentButton doc={d} />
                  <ActionButton action={deleteDocument.bind(null, d.id)} confirm="Smazat dokument trvale? Odkazy z faktur a transakcí se odstraní." size="icon" icon={<Trash2 className="h-4 w-4" />} />
                </li>
              );
            })}
          </ul>
        ) : <div className="p-4"><EmptyState title="Žádné dokumenty">Nahrajte PDF nebo fotografie. Účtenky lze přikládat přímo k výdajům, faktury k fakturám.</EmptyState></div>}
      </Card>
    </div>
  );
}
