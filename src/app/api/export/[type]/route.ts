import { NextResponse } from "next/server";
import { apiContext } from "@/lib/context";
import { loadData } from "@/lib/data";
import { toCSV } from "@/lib/csv";
import { toInputValue } from "@/lib/money";
import { shiftCosts, shiftGross, shiftNet } from "@/lib/finance/work";
import { PAYMENT_METHOD_LABEL } from "@/lib/defaults";
import { isInvoiceOverdue } from "@/lib/finance/obligations";
import { todayISO } from "@/lib/dates";

const m = (c: number | null | undefined) => (c == null ? "" : toInputValue(c));

/** Export dat do CSV (UTF-8 s BOM, oddělovač středník – otevře se správně v Excelu). */
export async function GET(_: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const ctx = await apiContext();
  if (ctx instanceof Response) return ctx;
  const d = await loadData(ctx);
  const cat = (id: string | null) => d.categories.find((c) => c.id === id)?.name ?? "";
  const acc = (id: string | null) => d.accounts.find((a) => a.id === id)?.name ?? "";
  const mem = (id: string | null) => d.members.find((x) => x.id === id)?.name ?? "";
  const today = todayISO();
  let rows: (string | number | null)[][];
  switch (type) {
    case "transakce":
      rows = [["Datum", "Typ", "Stav", "Částka (Kč)", "Účet", "Cílový účet", "Kategorie", "Popis", "Kdo", "Společný/osobní", "Způsob platby", "Pravidelná", "Zdroj", "Poznámka"],
        ...d.transactions.map((t) => [t.date, { income: "příjem", expense: "výdaj", transfer: "převod" }[t.type], t.status === "posted" ? "platná" : "stornovaná", m(t.amount), acc(t.account_id), acc(t.transfer_account_id), cat(t.category_id), t.description, mem(t.member_id), t.scope === "shared" ? "společný" : "osobní", PAYMENT_METHOD_LABEL[t.payment_method], t.is_recurring ? "ano" : "ne", t.source, t.note ?? ""])];
      break;
    case "faktury":
      rows = [["Číslo", "Druh", "Protistrana", "IČO", "Vystaveno", "Splatnost", "Uhrazeno", "Částka (Kč)", "Stav", "V plánu", "Poznámka"],
        ...d.invoices.map((i) => [i.number, i.direction === "issued" ? "vystavená" : "přijatá", i.counterparty, i.counterparty_ico ?? "", i.issue_date, i.due_date ?? "", i.paid_date ?? "", m(i.amount), i.status === "paid" ? "zaplacená" : i.status === "cancelled" ? "stornovaná" : isInvoiceOverdue(i, today) ? "po splatnosti" : "nezaplacená", i.include_in_plan ? "ano" : "ne", i.note ?? ""])];
      break;
    case "smeny":
      rows = [["Datum", "Kdo", "Odpracováno (min)", "Špička (min)", "Běžné trasy", "Expresní trasy", "Objednávky", "Základ", "Spropitné", "Bonusy", "Odměny", "Pronájem vozidla", "Vybavení", "Soukromé km", "Náklad km", "Ostatní srážky", "Hrubý příjem", "Náklady", "Čistý výsledek", "Poznámka"],
        ...d.shifts.map((s) => [s.date, mem(s.member_id), s.minutes, s.peak_minutes, s.regular_routes, s.express_routes, s.orders, m(s.base_earnings), m(s.tips), m(s.bonuses), m(s.rewards), m(s.vehicle_rent), m(s.equipment_cost), s.private_km.replace(".", ","), m(s.private_km_cost), m(s.other_deductions), m(shiftGross(s)), m(shiftCosts(s)), m(shiftNet(s)), s.note ?? ""])];
      break;
    case "vyplaty":
      rows = [["Označení", "Období od", "Období do", "Očekáváno", "Očekávané datum", "Přijato", "Datum přijetí", "Rozdíl", "Stav"],
        ...d.payouts.map((p) => [p.label, p.period_from ?? "", p.period_to ?? "", m(p.expected_amount), p.expected_date, m(p.received_amount), p.received_date ?? "", p.received_amount != null ? m(p.received_amount - p.expected_amount) : "", { expected: "očekávaná", received: "přijatá", cancelled: "zrušená" }[p.status]])];
      break;
    default:
      return NextResponse.json({ error: "Neznámý export" }, { status: 404 });
  }
  return new NextResponse(toCSV(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="homeos-${type}-${today}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
