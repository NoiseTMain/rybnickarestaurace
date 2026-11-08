import { requireContext } from "@/lib/context";
import { todayISO } from "@/lib/dates";
import { Card, PageHeader } from "@/components/ui/Card";
import { TaxHelper } from "@/components/TaxHelper";

export const metadata = { title: "Daně OSVČ" };

export default async function TaxPage() {
  const ctx = await requireContext();
  const year = todayISO().slice(0, 4);
  const invoices = (await ctx.store.select("invoices", { household_id: ctx.household.id })).filter((i) => i.status !== "cancelled" && i.issue_date.startsWith(year));
  const issued = invoices.filter((i) => i.direction === "issued").reduce((a, i) => a + i.amount, 0);
  const received = invoices.filter((i) => i.direction === "received").reduce((a, i) => a + i.amount, 0);
  return (
    <div className="space-y-4">
      <PageHeader title="Daňový pomocník OSVČ" subtitle={`Kolik zaplatíte na dani a pojištění za rok ${year} a kolik si měsíčně odkládat`} />
      <Card><TaxHelper issued={issued} received={received} /></Card>
    </div>
  );
}
