import { Trash2 } from "lucide-react";
import { requireContext } from "@/lib/context";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { loadSnapshot } from "@/lib/data";
import { formatDate, monthName } from "@/lib/dates";
import { formatMoney, sub } from "@/lib/money";
import { GOAL_KIND_LABEL } from "@/lib/defaults";
import { deleteContribution, deleteGoal } from "@/lib/actions/savings";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { ActionButton } from "@/components/ui/ActionButton";
import { ContributionButton, GoalButton } from "@/components/forms/SavingsForms";
import { KV } from "@/components/dashboard/bits";

export const metadata = { title: "Spoření" };

export default async function SavingsPage() {
  const ctx = await requireContext();
  const { data, snapshot: s, today } = await loadSnapshot(ctx);
  const pl = s.planner;
  const debts = data.recurring.filter((r) => r.is_debt && r.is_active);
  const outputs = [
    { n: 1, label: "Musí zůstat na účtu", value: pl.mustKeep, hint: "rezervované cíle, závazky, rozpočty, rezerva" },
    { n: 2, label: "Můžeme bezpečně utratit", value: pl.safeToSpend, hint: "navíc nad plán, do konce měsíce", gold: true },
    { n: 3, label: "Máme ještě odložit", value: pl.toSave, hint: "podle plánu cílů na tento měsíc" },
    { n: 4, label: "Potřebujeme ještě vydělat", value: pl.needToEarn, hint: pl.needToEarn > 0 ? "aby vyšlo vše výše" : "nic – vše je pokryto", neg: pl.needToEarn > 0 },
    { n: 5, label: "Můžeme dát na spoření", value: pl.canSave, hint: "pokud nic navíc neutratíme" },
  ];
  return (
    <div className="space-y-4">
      <ReadOnlyNotice ctx={ctx} section="savings" />
      <PageHeader title="Spoření a plánovač" subtitle="Cíle, pravidelné vklady a chytrý plán na zbytek měsíce" actions={<><ContributionButton label="Vklad" size="md" /><GoalButton label="Nový cíl" variant="primary" size="md" /></>} />

      <Card id="planovac" variant="light" title="Chytrý finanční plánovač" subtitle={`Zbytek měsíce ${monthName(today)} · ${s.daysLeftInMonth} dní`}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {outputs.map((o) => (
            <div key={o.n} className="rounded-2xl bg-black/25 p-3">
              <p className="text-[11px] uppercase tracking-wider text-ink-2">{o.n}. {o.label}</p>
              <p className={`num mt-1 text-2xl font-semibold ${o.gold ? "gold-text" : ""} ${o.neg ? "text-neg" : ""}`}>{formatMoney(o.value, { decimals: "never" })}</p>
              <p className="mt-0.5 text-xs text-ink-3">{o.hint}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-3">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-2">Výchozí stav</p>
            <KV k="Běžné účty a hotovost" v={<Money value={s.balance.liquid} />} />
            <KV k="Spořicí účty (mimo plán)" v={<Money value={s.balance.nonLiquid} />} />
            <KV k="Disponibilní" v={<Money value={pl.available} />} strong />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-2">Co musí zůstat</p>
            {pl.breakdown.map((b) => <KV key={b.label} k={b.label} v={<Money value={b.amount} />} />)}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-2">Očekávané příjmy (NEzapočteno)</p>
            {s.expectedIncomes.length ? s.expectedIncomes.slice(0, 6).map((e) => <KV key={e.key} k={<span>{e.name} <span className="text-ink-3">{formatDate(e.date)}</span>{e.late && <Badge tone="warning" className="ml-1">zpožděno</Badge>}</span>} v={<Money value={e.amount} />} />) : <p className="text-sm text-ink-3">Žádné.</p>}
            {s.expectedIncomeTotal > 0 && <p className="mt-2 text-xs text-ink-2">Až dorazí, bude bezpečně k utracení přibližně <b><Money value={pl.safeToSpendIfIncomeArrives} decimals="never" /></b>.</p>}
          </div>
        </div>
        {debts.length > 0 && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-2">Dluhy a závazky</p>
            {debts.map((d) => <KV key={d.id} k={d.name} v={<>splátka <Money value={d.amount} /> · zbývá <Money value={d.debt_remaining ?? 0} /></>} />)}
          </div>
        )}
      </Card>

      {s.goals.progress.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {s.goals.progress.map((g) => {
            const contribs = data.contributions.filter((c) => c.goal_id === g.goal.id).sort((a, b) => b.date.localeCompare(a.date));
            const account = data.accounts.find((a) => a.id === g.goal.account_id);
            return (
              <Card key={g.goal.id} title={g.goal.name} subtitle={`${GOAL_KIND_LABEL[g.goal.kind]} · priorita ${g.goal.priority}${account ? ` · ${account.name}` : " · vyčleněno na běžném účtu"}`}
                action={<div className="flex"><GoalButton initial={g.goal} size="icon" variant="ghost" /><ActionButton action={deleteGoal.bind(null, g.goal.id)} confirm="Smazat cíl i s historií vkladů?" size="icon" icon={<Trash2 className="h-4 w-4" />} /></div>}>
                <div className="flex items-baseline justify-between">
                  <Money value={g.saved} className="text-2xl font-semibold" decimals="never" />
                  <span className="num text-sm text-gold">{g.percent} %</span>
                </div>
                <Progress className="mt-2" value={g.percent} label={g.goal.name} />
                <p className="mt-1 text-xs text-ink-3">z {formatMoney(g.goal.target_amount, { decimals: "never" })} · chybí {formatMoney(g.remaining, { decimals: "never" })}</p>
                <div className="mt-3">
                  {g.goal.target_date && <KV k="Termín" v={formatDate(g.goal.target_date)} />}
                  {g.requiredMonthly != null && !g.achieved && <KV k="Nutno odkládat měsíčně" v={<Money value={g.requiredMonthly} className="text-gold" />} strong />}
                  {g.goal.monthly_contribution != null && <KV k="Pravidelný vklad" v={<Money value={g.goal.monthly_contribution} />} />}
                  <KV k="Tento měsíc odloženo" v={<><Money value={g.contributedThisMonth} /> / <Money value={g.plannedThisMonth} /></>} />
                  {g.estimatedDate && <KV k="Odhad splnění" v={monthName(g.estimatedDate)} />}
                  {g.overdue && <Badge tone="danger">termín uplynul</Badge>}
                  {g.achieved && <Badge tone="positive">splněno 🎉</Badge>}
                </div>
                <div className="mt-3 flex justify-end"><ContributionButton goalId={g.goal.id} /></div>
                {contribs.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-xs text-ink-3">Historie vkladů ({contribs.length})</summary>
                    <ul className="mt-2 space-y-1">
                      {contribs.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 text-xs">
                          <span className="text-ink-3">{formatDate(c.date)}</span><span className="flex-1 truncate text-ink-2">{c.note}</span>
                          <Money value={c.amount} sign colored />
                          <ActionButton action={deleteContribution.bind(null, c.id)} confirm="Smazat vklad?" size="icon" icon={<Trash2 className="h-3.5 w-3.5" />} />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><EmptyState title="Zatím žádné spořicí cíle" action={<GoalButton label="Vytvořit první cíl" variant="primary" />}>Rezerva, vybavení domácnosti, auto, dovolená, vlastní podnikání… Aplikace spočítá, kolik je potřeba měsíčně odkládat.</EmptyState></Card>
      )}
      <p className="text-xs text-ink-3">Celkem naspořeno {formatMoney(s.goals.totalSaved)} · potřeba měsíčně na všechny cíle {formatMoney(s.goals.requiredMonthlyTotal)} · {sub(s.goals.totalTarget, s.goals.totalSaved) > 0 ? `do splnění všech cílů chybí ${formatMoney(sub(s.goals.totalTarget, s.goals.totalSaved))}` : "všechny cíle splněny"}.</p>
    </div>
  );
}
