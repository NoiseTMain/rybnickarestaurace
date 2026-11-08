import { Check, Crown, X } from "lucide-react";
import { requireContext } from "@/lib/context";
import { getPremium } from "@/lib/premium";
import { billingConfigured } from "@/lib/billing";
import { FREE_LIMITS, PREMIUM_FEATURES } from "@/lib/plans";
import { formatDate } from "@/lib/dates";
import { Card, PageHeader } from "@/components/ui/Card";
import { CheckoutButtons } from "@/components/premium/CheckoutButtons";

export const metadata = { title: "Premium" };

const ROWS: [string, string | boolean, string | boolean][] = [
  ["Příjmy, výdaje, účty, rozpočty, jídlo", true, true],
  ["Pravidelné platby, spoření a plánovač", true, true],
  ["Práce, faktury, nákupy, plánování, dokumenty", true, true],
  ["Finanční asistent (odpovědi z vašich dat)", true, true],
  ["AI asistent – ptejte se na cokoli", false, true],
  ["Čtení účtenek a faktur z fotky", false, true],
  ["Cestování (trasy, vyrovnání, hotovost, program…)", false, true],
  ["Upozornění na telefon a měsíční uzávěrka", false, true],
  ["Členové domácnosti", `${FREE_LIMITS.members}`, "neomezeně"],
  ["Vlastní domácnosti", `${FREE_LIMITS.households}`, "neomezeně"],
  ["Všechny barvy a interiérová pozadí", false, true],
];

export default async function PremiumPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const p = await getPremium(ctx);
  const sub = (await ctx.store.select("subscriptions", { user_id: ctx.user.id }))[0] ?? null;
  const cell = (v: string | boolean) => (v === true ? <Check className="mx-auto h-4 w-4 text-pos" /> : v === false ? <X className="mx-auto h-4 w-4 text-ink-3" /> : <span className="text-sm">{v}</span>);
  return (
    <div className="space-y-4">
      <PageHeader title="HomeOS Premium" subtitle="Základ je zdarma navždy. Premium přidá AI, cestování, upozornění a víc členů." />
      {sp.dekujeme && !p.user && <Card variant="light" className="!p-4 text-sm">Děkujeme! Platba se zpracovává – Premium se aktivuje během pár vteřin. Obnovte stránku.</Card>}
      {p.household ? (
        <Card variant="light" className="!p-5">
          <div className="flex items-start gap-3">
            <Crown className="mt-0.5 h-6 w-6 shrink-0 text-gold" />
            <div className="text-sm">
              <p className="text-lg font-semibold">{p.isAdmin ? "Jste správce – Premium máte napořád" : p.user ? "Máte Premium" : "Vaše domácnost má Premium"}</p>
              {!p.isAdmin && !p.user && <p className="text-ink-2">Premium má jiný člen této domácnosti – platí pro všechny její členy.</p>}
              {sub && !p.isAdmin && (
                <p className="text-ink-2">
                  {sub.source === "admin" ? "Aktivováno správcem" : sub.variant === "yearly" ? "Roční předplatné" : "Měsíční předplatné"}
                  {sub.status === "cancelled" && sub.ends_at ? ` · zrušeno, platí do ${formatDate(sub.ends_at.slice(0, 10))}` : sub.renews_at ? ` · obnoví se ${formatDate(sub.renews_at.slice(0, 10))}` : sub.ends_at ? ` · platí do ${formatDate(sub.ends_at.slice(0, 10))}` : ""}
                </p>
              )}
              {sub?.portal_url && <a href={sub.portal_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-gold underline">Spravovat předplatné (platební karta, zrušení, faktury)</a>}
            </div>
          </div>
        </Card>
      ) : (
        <Card title="Vyberte si">
          <CheckoutButtons enabled={billingConfigured()} />
          <p className="mt-3 text-xs text-ink-3">Platbu zpracovává Lemon Squeezy (jako prodejce vystaví doklad a odvede DPH). Předplatné zrušíte kdykoli jedním kliknutím, Premium pak platí do konce zaplaceného období. Premium jednoho člena platí pro celou domácnost.</p>
        </Card>
      )}
      <Card title="Co je zdarma a co v Premium" bodyClassName="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-xs text-ink-3"><tr><th className="py-1 text-left font-medium" /><th className="w-24 font-medium">Zdarma</th><th className="w-24 font-medium text-gold">Premium</th></tr></thead>
          <tbody>{ROWS.map(([label, free, prem]) => <tr key={label} className="border-t border-white/[0.06]"><td className="py-2">{label}</td><td className="text-center">{cell(free)}</td><td className="text-center">{cell(prem)}</td></tr>)}</tbody>
        </table>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {PREMIUM_FEATURES.map((f) => <Card key={f.key} className="!p-4"><p className="font-medium">{f.title}</p><p className="text-sm text-ink-2">{f.detail}</p></Card>)}
      </div>
    </div>
  );
}
