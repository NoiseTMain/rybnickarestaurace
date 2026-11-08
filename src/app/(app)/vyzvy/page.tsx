import { Trash2 } from "lucide-react";
import { requireContext } from "@/lib/context";
import { loadData } from "@/lib/data";
import { monthName, todayISO } from "@/lib/dates";
import { evaluateChallenge, suggestChallenges, CHALLENGE_META } from "@/lib/finance/challenges";
import { removeChallenge } from "@/lib/actions/challenges";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import { ActionButton } from "@/components/ui/ActionButton";
import { ChallengeAccept } from "@/components/ChallengeAccept";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";

export const metadata = { title: "Výzvy" };

const STATUS = { done: { tone: "positive", label: "splněno 🎉" }, failed: { tone: "danger", label: "nevyšlo" }, active: { tone: "gold", label: "běží" } } as const;

export default async function ChallengesPage() {
  const ctx = await requireContext();
  const today = todayISO();
  const month = today.slice(0, 7);
  const [data, all] = await Promise.all([loadData(ctx), ctx.store.select("challenges", { household_id: ctx.household.id })]);
  const input = { txs: data.transactions, categories: data.categories, contributions: data.contributions, today };
  const current = all.filter((c) => c.month === month).map((c) => evaluateChallenge(c, input));
  const past = all.filter((c) => c.month < month).sort((a, b) => b.month.localeCompare(a.month)).map((c) => evaluateChallenge(c, input));
  const suggestions = suggestChallenges(input, all.filter((c) => c.month === month));
  const doneCount = past.filter((p) => p.status === "done").length;
  const catName = (id: string | null) => data.categories.find((c) => c.id === id)?.name;
  return (
    <div className="space-y-4">
      <ReadOnlyNotice ctx={ctx} section="finance" />
      <PageHeader title="Výzvy" subtitle={`${monthName(`${month}-01`)} · malé měsíční cíle, které šetří peníze a baví`} />
      <Card title="Moje výzvy tento měsíc" data-testid="challenges">
        {current.length ? (
          <ul className="space-y-3">
            {current.map((c) => (
              <li key={c.challenge.id} className="rounded-2xl bg-black/25 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden>{c.emoji}</span>
                  <b className="flex-1 text-sm">{c.title}</b>
                  <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                  <ActionButton action={removeChallenge.bind(null, c.challenge.id!)} confirm="Zrušit výzvu?" size="icon" icon={<Trash2 className="h-3.5 w-3.5" />} />
                </div>
                <Progress className="mt-2" value={c.percent} label={c.title} />
                <p className="mt-1 text-xs text-ink-3">{c.detail}</p>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="Zatím žádná výzva">Vyberte si níže – stačí jedna a uvidíte rozdíl na konci měsíce.</EmptyState>}
      </Card>
      {suggestions.length > 0 && (
        <Card title="Návrhy na míru" subtitle="Podle vašich výdajů z minulého měsíce – cíl si můžete upravit">
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((s) => {
              const m = CHALLENGE_META[s.kind];
              return (
                <div key={s.kind} className="rounded-2xl bg-black/25 p-3">
                  <p className="text-sm font-semibold"><span aria-hidden>{m.emoji}</span> {m.title}{s.category_id ? `: ${catName(s.category_id)}` : ""}</p>
                  <p className="text-xs text-ink-3">{s.kind === "no_takeout" ? "Restaurace, rozvoz a kavárny – nastavte limit (0 = úplně bez)." : s.kind === "no_spend_days" ? "Kolik dní v měsíci nekoupíte nic navíc (nájem a pravidelné platby se nepočítají)." : s.kind === "category_cut" ? "O kolik procent méně než minulý měsíc." : s.kind === "save_amount" ? "Kolik tento měsíc odložíte na spořicí cíle." : "Kolik dní v řadě si zapíšete výdaje – zvyk, který mění všechno."}</p>
                  <ChallengeAccept kind={s.kind} target={s.target} categoryId={s.category_id} unit={m.unit} />
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {past.length > 0 && (
        <Card title="Historie" subtitle={`Splněno ${doneCount} z ${past.length}`}>
          <ul className="space-y-1 text-sm">
            {past.map((c) => <li key={c.challenge.id} className="flex items-center gap-2"><span aria-hidden>{c.emoji}</span><span className="flex-1">{c.title} <span className="text-ink-3">· {monthName(`${c.challenge.month}-01`)}</span></span><Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge></li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}
