import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { requireContext } from "@/lib/context";
import { todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { vatStatus, VAT_LIMIT } from "@/lib/finance/vat";
import { Card, PageHeader } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { TaxHelper } from "@/components/TaxHelper";

export const metadata = { title: "Daně OSVČ" };

const VAT_TEXT = {
  ok: "Jste v bezpečí pod limitem.",
  warning: "Blížíte se k limitu – zvažte, jak se k DPH postavíte (registrace, rozložení zakázek). Poraďte se s účetní.",
  over: "Překročili jste limit 2 000 000 Kč: plátcem DPH se stáváte od 1. ledna příštího roku. Registraci podejte do 10 pracovních dnů po konci měsíce, kdy jste limit překročili.",
  immediate: "Překročili jste 2 536 500 Kč: plátcem DPH jste už ode dne následujícího po překročení. Kontaktujte účetní co nejdřív.",
} as const;

export default async function TaxPage() {
  const ctx = await requireContext();
  const year = todayISO().slice(0, 4);
  const all = await ctx.store.select("invoices", { household_id: ctx.household.id });
  const invoices = all.filter((i) => i.status !== "cancelled" && i.issue_date.startsWith(year));
  const issued = invoices.filter((i) => i.direction === "issued").reduce((a, i) => a + i.amount, 0);
  const received = invoices.filter((i) => i.direction === "received").reduce((a, i) => a + i.amount, 0);
  const vat = vatStatus(all, year);
  return (
    <div className="space-y-4">
      <PageHeader title="Daňový pomocník OSVČ" subtitle={`Kolik zaplatíte na dani a pojištění za rok ${year} a kolik si měsíčně odkládat`}
        actions={<><Link href={`/tisk/dane?rok=${year}`} className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm"><FileText className="h-4 w-4" />Podklady pro účetní (PDF)</Link><a href="/api/export/faktury" download className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm"><Download className="h-4 w-4" />Faktury CSV</a></>} />
      <Card title="Limit pro DPH" subtitle={`Obrat z vystavených faktur za rok ${year} · limit ${formatMoney(VAT_LIMIT, { decimals: "never" })}`} data-testid="vat">
        <div className="flex items-baseline justify-between gap-2"><span className="num text-2xl font-semibold">{formatMoney(vat.turnover, { decimals: "never" })}</span><span className={`text-sm ${vat.level === "ok" ? "text-ink-3" : "text-neg"}`}>{Math.round(vat.share * 100)} %</span></div>
        <Progress className="mt-2" value={Math.min(100, vat.share * 100)} label="Obrat vůči limitu DPH" />
        <p className={`mt-2 text-sm ${vat.level === "ok" ? "text-ink-2" : "text-neg"}`}>{VAT_TEXT[vat.level]}{vat.level === "ok" || vat.level === "warning" ? ` Do limitu zbývá ${formatMoney(vat.remaining, { decimals: "never" })}.` : ""}</p>
        <p className="mt-1 text-xs text-ink-3">Počítá se jen z faktur zapsaných v HomeOS. Limity jsou orientační – ověřte je na financnisprava.cz.</p>
      </Card>
      <Card><TaxHelper issued={issued} received={received} /></Card>
    </div>
  );
}
