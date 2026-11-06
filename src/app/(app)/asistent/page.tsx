import { requireContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { buildInsights } from "@/lib/assistant";
import { Card, PageHeader } from "@/components/ui/Card";
import { InsightItem } from "@/components/dashboard/bits";
import { AssistantChat } from "./AssistantChat";

export const metadata = { title: "Finanční asistent" };

export default async function AssistantPage() {
  const ctx = await requireContext();
  const { data, snapshot } = await loadSnapshot(ctx);
  const insights = buildInsights(snapshot, data);
  return (
    <div className="space-y-4">
      <PageHeader title="Finanční asistent" subtitle="Analýza vašich skutečných dat – žádné odhady z ničeho. Když údaje chybí, asistent se doptá." />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card variant="dark" title="Zeptejte se" subtitle="Odpovědi se počítají z databáze v okamžiku dotazu">
          <AssistantChat />
        </Card>
        <Card title="Doporučení a upozornění" subtitle={`${insights.length} postřehů`}>
          <div className="space-y-2">{insights.map((i) => <InsightItem key={i.id} i={i} />)}</div>
          {!insights.length && <p className="text-sm text-ink-3">Zatím nemám dost dat.</p>}
        </Card>
      </div>
    </div>
  );
}
