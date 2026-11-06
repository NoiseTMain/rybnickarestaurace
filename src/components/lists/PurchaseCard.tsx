import { CheckCircle2, Clock, ExternalLink, ImageOff, Trash2 } from "lucide-react";
import { formatDate, monthName } from "@/lib/dates";
import type { AffordabilityResult } from "@/lib/finance/affordability";
import type { Purchase } from "@/lib/db/types";
import { PURCHASE_STATUS_LABEL } from "@/lib/defaults";
import { deletePurchase, setPurchaseStatus } from "@/lib/actions/purchases";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { ActionButton } from "@/components/ui/ActionButton";
import { BoughtButton, PurchaseButton } from "@/components/forms/PurchaseForms";

/** Karta nákupu – s fotkou produktu, dostupností a akcemi. */
export function PurchaseCard({ p, r, categoryName, queued, showPhoto = true }: { p: Purchase; r: AffordabilityResult | null; categoryName?: string; queued?: boolean; showPhoto?: boolean }) {
  const host = p.url ? (() => { try { return new URL(p.url).hostname.replace(/^www\./, ""); } catch { return null; } })() : null;
  return (
    <Card className="flex flex-col !p-0 overflow-hidden">
      {showPhoto && (
        p.image_document_id ? (
          <a href={p.url ?? `/api/files/${p.image_document_id}`} target="_blank" rel="noreferrer noopener" className="block bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/files/${p.image_document_id}`} alt={p.name} loading="lazy" className="aspect-[4/3] w-full object-contain" />
          </a>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-white/[0.03] text-ink-3"><ImageOff className="h-8 w-8" /></div>
        )
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-medium">{p.name}</p>
            <p className="mt-1 flex flex-wrap gap-1 text-[11px] text-ink-3">
              <Badge tone={p.priority <= 2 ? "gold" : "neutral"}>priorita {p.priority}</Badge>
              <Badge tone={p.status === "buying" ? "info" : p.status === "bought" ? "positive" : "neutral"}>{PURCHASE_STATUS_LABEL[p.status]}</Badge>
              {p.room && <Badge>{p.room}</Badge>}
              {categoryName && <Badge>{categoryName}</Badge>}
              {p.is_wish && <Badge>přání</Badge>}
              {p.planned_date && <span className="self-center">plán {formatDate(p.planned_date)}</span>}
            </p>
          </div>
          <Money value={p.price} decimals="never" className="text-lg font-semibold" />
        </div>
        {r && (r.affordable ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-pos/10 px-3 py-2 text-sm text-pos"><CheckCircle2 className="h-4 w-4 shrink-0" />Můžete si dovolit{queued && " (i po prioritnějších nákupech)"}.</p>
        ) : (
          <div className="mt-3 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">
            <p className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" />Chybí <b><Money value={r.shortfall} decimals="never" /></b> – tolik je potřeba ušetřit.</p>
            <p className="mt-0.5 text-xs text-ink-2">{r.affordableFrom ? `Bezpečně přibližně od ${monthName(r.affordableFrom)} (za ${r.monthsNeeded} měs.). ${r.reason}` : r.reason}</p>
          </div>
        ))}
        {p.note && <p className="mt-2 text-xs text-ink-2">{p.note}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-end gap-1 pt-3">
          {p.url && <a href={p.url} target="_blank" rel="noreferrer noopener" className="mr-auto flex min-w-0 items-center gap-1 truncate text-xs text-gold hover:underline"><ExternalLink className="h-3.5 w-3.5 shrink-0" />{host ?? "Odkaz"}</a>}
          {p.status === "planned" && <ActionButton action={setPurchaseStatus.bind(null, p.id, "buying")} size="sm">Kupuji</ActionButton>}
          {p.status !== "bought" && <BoughtButton purchase={p} />}
          <PurchaseButton initial={p} size="icon" variant="ghost" />
          <ActionButton action={deletePurchase.bind(null, p.id)} confirm="Smazat nákup?" size="icon" icon={<Trash2 className="h-4 w-4" />} />
        </div>
      </div>
    </Card>
  );
}
