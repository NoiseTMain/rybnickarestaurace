import { Download } from "lucide-react";
import { requireContext } from "@/lib/context";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { loadData } from "@/lib/data";
import { endOfMonth, formatDate, todayISO } from "@/lib/dates";
import { sum } from "@/lib/money";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { LinkButton } from "@/components/ui/Button";
import { TxRow } from "@/components/lists/TxRow";
import { MonthHistory } from "@/components/lists/MonthHistory";
import { FilterSearch, FilterSelect, FilterTabs, MonthPicker } from "@/components/lists/Filters";
import { TransactionButton } from "@/components/forms/TransactionForm";
import { BankImportButton } from "@/components/forms/CsvImport";

export const metadata = { title: "Příjmy a výdaje" };

type SP = Promise<Record<string, string | undefined>>;

export default async function TransactionsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const data = await loadData(ctx);
  const month = /^\d{4}-\d{2}$/.test(sp.mesic ?? "") ? sp.mesic! : sp.mesic === "vse" ? "" : todayISO().slice(0, 7);
  const from = month ? `${month}-01` : "0000-01-01";
  const to = month ? endOfMonth(from) : "9999-12-31";
  const q = (sp.q ?? "").toLowerCase();
  const list = data.transactions.filter((t) =>
    t.date >= from && t.date <= to &&
    (!sp.typ || t.type === sp.typ) &&
    (sp.stav === "storno" ? t.status === "cancelled" : sp.stav === "vse" ? true : t.status === "posted") &&
    (!sp.kategorie || t.category_id === sp.kategorie) &&
    (!sp.ucet || t.account_id === sp.ucet || t.transfer_account_id === sp.ucet) &&
    (!sp.clen || t.member_id === sp.clen) &&
    (!q || `${t.description} ${t.note ?? ""}`.toLowerCase().includes(q)),
  );
  const postedList = list.filter((t) => t.status === "posted");
  const income = sum(postedList.filter((t) => t.type === "income"), (t) => t.amount);
  const expense = sum(postedList.filter((t) => t.type === "expense"), (t) => t.amount);
  const byDate = new Map<string, typeof list>();
  for (const t of list) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);

  return (
    <div>
      <ReadOnlyNotice ctx={ctx} section="finance" className="mb-4" />
      <PageHeader
        title="Příjmy a výdaje"
        subtitle="Všechny pohyby na účtech. Storno ponechá záznam v historii, ale přestane ho započítávat."
        actions={<>
          <TransactionButton defaultType="income" label="Příjem" />
          <TransactionButton defaultType="expense" label="Výdaj" variant="primary" />
          <TransactionButton defaultType="transfer" label="Převod" />
          <BankImportButton />
          <LinkButton href="/api/export/transakce" icon={<Download className="h-4 w-4" />}>Export</LinkButton>
        </>}
      />
      <div className="mb-4"><FilterTabs name="zobrazeni" options={[{ value: "", label: "Pohyby" }, { value: "mesice", label: "Historie měsíců" }]} /></div>
      {sp.zobrazeni === "mesice" ? <MonthHistory transactions={data.transactions} categories={data.categories} today={todayISO()} /> : <>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Příjmy</p><Money value={income} className="text-lg font-semibold text-pos sm:text-2xl" decimals="never" /></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Výdaje</p><Money value={expense} className="text-lg font-semibold sm:text-2xl" decimals="never" /></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Rozdíl</p><Money value={income - expense} colored className="text-lg font-semibold sm:text-2xl" decimals="never" /></Card>
      </div>
      <Card className="!p-0">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-3 sm:p-4">
          <FilterTabs name="typ" options={[{ value: "", label: "Vše" }, { value: "expense", label: "Výdaje" }, { value: "income", label: "Příjmy" }, { value: "transfer", label: "Převody" }]} />
          <div className="flex flex-wrap gap-2">
            <MonthPicker value={month} />
            <LinkButton href={month ? "/transakce?mesic=vse" : "/transakce"} size="sm" variant={month ? "secondary" : "primary"} className="!h-10">{month ? "Celá historie" : "Jen měsíc"}</LinkButton>
            <FilterSelect name="kategorie" label="Kategorie">
              <option value="">Všechny kategorie</option>
              {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.kind === "income" ? " (příjem)" : ""}</option>)}
            </FilterSelect>
            <FilterSelect name="ucet" label="Účet"><option value="">Všechny účty</option>{data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</FilterSelect>
            <FilterSelect name="clen" label="Člen"><option value="">Všichni</option>{data.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</FilterSelect>
            <FilterSelect name="stav" label="Stav"><option value="">Platné</option><option value="storno">Stornované</option><option value="vse">Vše</option></FilterSelect>
            <FilterSearch />
          </div>
        </div>
        {list.length ? (
          <div>
            {[...byDate.entries()].map(([date, items]) => (
              <div key={date}>
                <div className="sticky top-14 z-10 bg-[#151413]/90 px-4 py-1.5 text-xs font-medium text-ink-3 backdrop-blur lg:top-0">{formatDate(date, "long")}</div>
                <ul className="divide-y divide-white/[0.04]">{items.map((t) => <TxRow key={t.id} t={t} />)}</ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4"><EmptyState title="Žádné transakce">Pro zvolené filtry nic nenalezeno. Přidejte příjem či výdaj, nebo importujte výpis z banky (CSV).</EmptyState></div>
        )}
      </Card>
      </>}
    </div>
  );
}
