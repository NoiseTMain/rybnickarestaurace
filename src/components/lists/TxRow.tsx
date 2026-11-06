"use client";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Ban, Paperclip, RotateCcw, Trash2 } from "lucide-react";
import { cancelTransaction, deleteTransaction, restoreTransaction } from "@/lib/actions/transactions";
import { formatDate } from "@/lib/dates";
import type { Transaction } from "@/lib/db/types";
import { useLookups } from "@/components/Lookups";
import { ActionButton } from "@/components/ui/ActionButton";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { TransactionButton } from "@/components/forms/TransactionForm";
import { cn } from "@/components/ui/cn";

const SOURCE: Record<string, string> = { csv: "import", payout: "výplata", recurring: "pravidelná", invoice: "faktura", purchase: "nákup", income_source: "příjem", savings: "spoření" };

export function TxRow({ t }: { t: Transaction }) {
  const lk = useLookups();
  const cat = lk.categories.find((c) => c.id === t.category_id);
  const acc = lk.accounts.find((a) => a.id === t.account_id);
  const to = lk.accounts.find((a) => a.id === t.transfer_account_id);
  const mem = lk.members.find((m) => m.id === t.member_id);
  const cancelled = t.status === "cancelled";
  const Icon = t.type === "income" ? ArrowDownLeft : t.type === "expense" ? ArrowUpRight : ArrowLeftRight;
  return (
    <li className={cn("group flex items-center gap-3 px-3 py-2.5 sm:px-4", cancelled && "opacity-50")}>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", t.type === "income" ? "bg-pos/15 text-pos" : t.type === "expense" ? "bg-white/[0.06] text-ink-2" : "bg-info/15 text-info")} style={cat && t.type === "expense" ? { color: cat.color } : undefined}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", cancelled && "line-through")}>{t.description || cat?.name || (t.type === "transfer" ? "Převod" : "—")}</p>
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink-3">
          <span>{formatDate(t.date, "day")}</span>
          {cat && <span>· {cat.name}</span>}
          <span>· {t.type === "transfer" ? `${acc?.name} → ${to?.name}` : acc?.name}</span>
          {mem && <span>· {mem.name}</span>}
          {t.scope === "personal" && <Badge>osobní</Badge>}
          {SOURCE[t.source] && <Badge>{SOURCE[t.source]}</Badge>}
          {cancelled && <Badge tone="danger">stornováno</Badge>}
          {t.document_id && <a href={`/api/files/${t.document_id}`} target="_blank" rel="noreferrer" className="text-gold" aria-label="Příloha"><Paperclip className="inline h-3 w-3" /></a>}
        </p>
      </div>
      <Money value={t.type === "expense" ? -t.amount : t.amount} sign={t.type === "income"} className={cn("text-sm font-medium", t.type === "income" && "text-pos", t.type === "transfer" && "text-info")} />
      <div className="flex shrink-0 items-center opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {!cancelled && <TransactionButton initial={t} variant="ghost" size="icon" />}
        {!cancelled ? (
          <ActionButton action={() => cancelTransaction(t.id)} confirm="Stornovat transakci? Zůstane v historii, ale přestane se započítávat." size="icon" icon={<Ban className="h-4 w-4" />} />
        ) : (
          <>
            <ActionButton action={() => restoreTransaction(t.id)} size="icon" icon={<RotateCcw className="h-4 w-4" />} />
            <ActionButton action={() => deleteTransaction(t.id)} confirm="Trvale smazat transakci?" size="icon" icon={<Trash2 className="h-4 w-4" />} />
          </>
        )}
      </div>
    </li>
  );
}
