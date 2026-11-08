import { Bell, Bot, Check, Crown, Palette, Plane, ScanText, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { headers } from "next/headers";
import { requireContext } from "@/lib/context";
import { ReferralCard } from "@/components/premium/ReferralCard";
import { getPremium } from "@/lib/premium";
import { billingConfigured } from "@/lib/billing";
import { trialEligible } from "@/lib/actions/billing";
import { loadSnapshot } from "@/lib/data";
import { FREE_LIMITS } from "@/lib/plans";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui/Card";
import { CheckoutButtons } from "@/components/premium/CheckoutButtons";

export const metadata = { title: "Premium" };
const kc = (c: number) => formatMoney(c, { decimals: "never" });

const ROWS: [string, string | boolean, string | boolean][] = [
  ["Příjmy, výdaje, účty, rozpočty, jídlo", true, true],
  ["Pravidelné platby, spoření a plánovač", true, true],
  ["Nákupy, plánování, dokumenty, recepty (výběr)", true, true],
  ["Finanční asistent (odpovědi z vašich dat)", true, true],
  ["AI asistent – ptejte se na cokoli", false, true],
  ["Čtení účtenek a faktur z fotky", false, true],
  ["Cestování (trasy, vyrovnání, hotovost, sdílení…)", false, true],
  ["Všech 500+ fitness receptů z 10 kuchyní", false, true],
  ["Upozornění na telefon a měsíční uzávěrka", false, true],
  ["Balíčky pro vaši situaci (podnikatel, samoživitel/ka, student…)", false, true],
  ["Členové domácnosti", `${FREE_LIMITS.members}`, "neomezeně"],
  ["Vlastní domácnosti", `${FREE_LIMITS.households}`, "neomezeně"],
  ["Všechny barvy a interiérová pozadí", false, true],
];

const FEATURES = [
  { icon: Bot, title: "AI asistent", text: "„Kolik jsme minulý měsíc utratili za jídlo a kde nejvíc?“ Odpoví z vašich dat, poradí, kde ušetřit." },
  { icon: Plane, title: "Cestování", text: "Trasa, doprava, rozpočet na místě, hotovost v eurech, kdo komu dluží – i s QR platbou." },
  { icon: ScanText, title: "Účtenky a faktury z fotky", text: "Vyfoťte účtenku – částka, datum a obchod se doplní samy." },
  { icon: Bell, title: "Nic nezmeškáte", text: "Připomínky plateb, týdenní souhrn, měsíční uzávěrka a upozornění na cestách." },
  { icon: Users, title: "Celá rodina", text: "Neomezeně členů i domácností. Premium jednoho platí pro všechny v domácnosti." },
  { icon: Palette, title: "Váš styl", text: "Všechny barvy, interiéry na pozadí i vlastní fotka." },
];

const FAQ: [string, string][] = [
  ["Jak funguje zkušební doba?", "3 dny máte celé Premium zdarma. Kartu zadáte předem, ale strhne se až po 3 dnech. Když předtím předplatné zrušíte, nezaplatíte nic. Zkušební dobu lze využít jen jednou."],
  ["Můžu předplatné zrušit?", "Kdykoli jedním kliknutím ve „Spravovat předplatné“. Premium vám pak zůstane do konce zaplaceného období."],
  ["Co se stane s mými daty, když Premium skončí?", "Nic se nesmaže. Prémiové funkce se jen zamknou a po obnovení je máte zpět i s daty."],
  ["Kdo zpracovává platbu?", "Lemon Squeezy – vystaví vám doklad a odvede DPH. Údaje o kartě do HomeOS nikdy neputují."],
];

export default async function PremiumPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const [p, { data, snapshot: s }] = await Promise.all([getPremium(ctx), loadSnapshot(ctx)]);
  const sub = (await ctx.store.select("subscriptions", { user_id: ctx.user.id }))[0] ?? null;
  const enabled = billingConfigured();
  // v nativní aplikaci (App Store / Google Play) se digitální předplatné nesmí prodávat mimo jejich platby
  const nativeApp = /HomeOSApp/.test((await headers()).get("user-agent") ?? "");
  const trial = !p.household && enabled && (await trialEligible(ctx.user.id, ctx.user.email).catch(() => false));
  const cell = (v: string | boolean) => (v === true ? <Check className="mx-auto h-4 w-4 text-pos" /> : v === false ? <X className="mx-auto h-4 w-4 text-ink-3" /> : <span className="text-sm">{v}</span>);
  // motivace z vlastních dat (nic si nevymýšlíme)
  const topCat = s.month.byCategory[0];
  const hooks = [
    topCat && topCat.amount > 0 ? `Tento měsíc u vás nejvíc stojí ${data.categories.find((c) => c.id === topCat.categoryId)?.name ?? "výdaje bez kategorie"} (${kc(topCat.amount)}). AI asistent vám ukáže, kde přesně ušetřit.` : null,
    s.upcoming.length ? `Čeká vás ${s.upcoming.length} plateb – s Premium vám připomeneme každou včas na telefon.` : null,
    data.travel.trips.length ? `Máte rozplánované cesty (${data.travel.trips.length}) – Premium je odemkne i s mapou, hotovostí a vyrovnáním.` : "Plánujete dovolenou? Premium spočítá rozpočet na místě i kdo komu dluží.",
  ].filter(Boolean) as string[];
  return (
    <div className="space-y-4">
      <PageHeader title={<span className="flex items-center gap-2"><Crown className="h-7 w-7 text-gold" />HomeOS Premium</span>} subtitle="Základ je zdarma navždy. Premium z HomeOS udělá vašeho osobního finančního poradce." />
      {sp.dekujeme && !p.user && <Card variant="light" className="!p-4 text-sm">Děkujeme! Platba se zpracovává – Premium se aktivuje během pár vteřin. Obnovte stránku.</Card>}
      {p.household ? (
        <Card variant="light" className="!p-5">
          <div className="flex items-start gap-3">
            <Crown className="mt-0.5 h-6 w-6 shrink-0 text-gold" />
            <div className="text-sm">
              <p className="text-lg font-semibold">{p.isAdmin ? "Jste správce – Premium máte napořád" : p.user ? (sub?.status === "on_trial" ? "Zkoušíte Premium zdarma" : "Máte Premium") : "Vaše domácnost má Premium"}</p>
              {!p.isAdmin && !p.user && <p className="text-ink-2">Premium má jiný člen této domácnosti – platí pro všechny její členy.</p>}
              {sub && !p.isAdmin && (
                <p className="text-ink-2">
                  {sub.source === "admin" ? "Aktivováno správcem" : sub.variant === "yearly" ? "Roční předplatné" : "Měsíční předplatné"}
                  {sub.status === "on_trial" && sub.renews_at ? ` · zkušební doba do ${formatDate(sub.renews_at.slice(0, 10))}, pak se začne platit` : sub.status === "cancelled" && sub.ends_at ? ` · zrušeno, platí do ${formatDate(sub.ends_at.slice(0, 10))}` : sub.renews_at ? ` · obnoví se ${formatDate(sub.renews_at.slice(0, 10))}` : sub.ends_at ? ` · platí do ${formatDate(sub.ends_at.slice(0, 10))}` : ""}
                </p>
              )}
              {sub?.portal_url && !nativeApp && <a href={sub.portal_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-gold underline">Spravovat předplatné (karta, zrušení, doklady)</a>}
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card variant="light" className="!p-5">
            <p className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-gold" />Proč právě vám</p>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-2">{hooks.map((h) => <li key={h} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />{h}</li>)}</ul>
          </Card>
          {nativeApp ? <Card className="!p-4 text-sm text-ink-2">Premium si můžete aktivovat ve webové verzi HomeOS. Po aktivaci se projeví i v této aplikaci.</Card> : <Card title="Vyberte si"><CheckoutButtons enabled={enabled} trial={trial} /></Card>}
        </>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {FEATURES.map((f) => <Card key={f.title} className="!p-4"><f.icon className="h-6 w-6 text-gold" /><p className="mt-2 font-medium">{f.title}</p><p className="text-sm text-ink-2">{f.text}</p></Card>)}
      </div>
      <Card id="doporuc" title="🎁 Doporuč kamarádovi – měsíc Premium oběma"><ReferralCard userId={ctx.user.id} /></Card>
      <Card title="Co je zdarma a co v Premium" bodyClassName="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-xs text-ink-3"><tr><th className="py-1 text-left font-medium" /><th className="w-24 font-medium">Zdarma</th><th className="w-24 font-medium text-gold">Premium</th></tr></thead>
          <tbody>{ROWS.map(([label, free, prem]) => <tr key={label} className="border-t border-white/[0.06]"><td className="py-2">{label}</td><td className="text-center">{cell(free)}</td><td className="text-center">{cell(prem)}</td></tr>)}</tbody>
        </table>
      </Card>
      <Card title="Časté otázky">
        <div className="space-y-2">{FAQ.map(([q, a]) => <details key={q} className="rounded-xl bg-white/[0.03] p-3"><summary className="cursor-pointer text-sm font-medium">{q}</summary><p className="mt-1 text-sm text-ink-2">{a}</p></details>)}</div>
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-3"><ShieldCheck className="h-4 w-4 text-gold" />Bez reklam a bez prodeje dat. Platby zabezpečuje Lemon Squeezy.</p>
      </Card>
    </div>
  );
}
