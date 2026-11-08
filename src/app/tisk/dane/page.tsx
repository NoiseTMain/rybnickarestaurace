import { requireContext } from "@/lib/context";
import { formatDate, monthName, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { vatStatus, yearInvoices } from "@/lib/finance/vat";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Podklady pro účetní" };

const kc = (c: number) => formatMoney(c);

/** Tisknutelné podklady pro účetní / daňové přiznání (Tisk → Uložit jako PDF). */
export default async function TaxPrintPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const year = /^\d{4}$/.test(sp.rok ?? "") ? sp.rok! : todayISO().slice(0, 4);
  const [invoices, settings] = await Promise.all([ctx.store.select("invoices", { household_id: ctx.household.id }), ctx.store.select("household_settings", { household_id: ctx.household.id })]);
  const y = yearInvoices(invoices, year);
  const vat = vatStatus(invoices, year);
  const ico = settings[0]?.ico_info;
  const Row = ({ i }: { i: (typeof y.issued)[number] }) => (
    <tr className="border-t border-black/10"><td className="py-1 pr-2">{i.number}</td><td className="pr-2">{formatDate(i.issue_date)}</td><td className="pr-2">{i.counterparty}{i.counterparty_ico ? ` (IČO ${i.counterparty_ico})` : ""}</td><td className="pr-2">{i.status === "paid" ? `uhrazeno ${formatDate(i.paid_date)}` : "neuhrazeno"}</td><td className="text-right">{kc(i.amount)}</td></tr>
  );
  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-[13px] text-black print:p-0" style={{ colorScheme: "light" }}>
      <div className="mb-4 flex items-start justify-between gap-4 print:hidden">
        <a href="/dane" className="text-sm underline">← Zpět</a>
        <PrintButton />
      </div>
      <h1 className="text-xl font-bold">Podklady pro účetní – rok {year}</h1>
      <p className="mt-1 text-black/70">{ico ? `${ico.name} · IČO ${ico.ico}${ico.dic ? ` · DIČ ${ico.dic}` : ""} · ${ico.address ?? ""}` : ctx.household.name} · vytvořeno {formatDate(todayISO())} v aplikaci HomeOS</p>

      <h2 className="mt-6 font-bold">Souhrn</h2>
      <table className="mt-1 w-full"><tbody>
        <tr><td>Vystavené faktury (příjmy)</td><td className="text-right font-semibold">{kc(y.issuedTotal)}</td></tr>
        <tr><td>Přijaté faktury (výdaje)</td><td className="text-right font-semibold">{kc(y.receivedTotal)}</td></tr>
        <tr><td>Rozdíl</td><td className="text-right font-semibold">{kc(y.issuedTotal - y.receivedTotal)}</td></tr>
        <tr><td>Obrat pro limit DPH (2 000 000 Kč)</td><td className="text-right">{Math.round(vat.share * 100)} %</td></tr>
        <tr><td>Neuhrazené faktury</td><td className="text-right">{y.unpaid.length}</td></tr>
      </tbody></table>

      <h2 className="mt-6 font-bold">Po měsících</h2>
      <table className="mt-1 w-full"><thead><tr className="text-left text-black/60"><th>Měsíc</th><th className="text-right">Vystavené</th><th className="text-right">Přijaté</th></tr></thead><tbody>
        {y.months.map((m) => <tr key={m.month} className="border-t border-black/10"><td className="py-1">{monthName(`${m.month}-01`)}</td><td className="text-right">{kc(m.issued)}</td><td className="text-right">{kc(m.received)}</td></tr>)}
      </tbody></table>

      <h2 className="mt-6 font-bold">Vystavené faktury ({y.issued.length})</h2>
      <table className="mt-1 w-full"><tbody>{y.issued.map((i) => <Row key={i.id} i={i} />)}</tbody></table>
      <h2 className="mt-6 font-bold">Přijaté faktury ({y.received.length})</h2>
      <table className="mt-1 w-full"><tbody>{y.received.map((i) => <Row key={i.id} i={i} />)}</tbody></table>
      <p className="mt-8 text-[11px] text-black/50">Orientační přehled z evidence v HomeOS. Doklady (PDF faktur) najdete v sekci Dokumenty. Nejde o daňové poradenství.</p>
    </main>
  );
}
