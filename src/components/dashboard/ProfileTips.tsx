import Link from "next/link";
import { Crown, Lightbulb } from "lucide-react";
import type { LifeProfile } from "@/lib/db/types";
import { profileDef } from "@/lib/profiles";
import { Card } from "@/components/ui/Card";

/** Tipy pro zvolenou životní situaci (celý balíček je v Premium). */
export function ProfileTips({ profile, premium }: { profile: LifeProfile | null; premium: boolean }) {
  const p = profileDef(profile);
  if (!p) {
    return (
      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Lightbulb className="h-5 w-5 text-gold" />
          <span className="flex-1">Řekněte nám, jaká je vaše situace (rodina, student, samoživitel/ka, podnikatel…), a přizpůsobíme aplikaci i tipy.</span>
          <Link href="/nastaveni#situace" className="rounded-full bg-gold/90 px-3 py-1.5 text-xs font-medium text-[#1b1407]">Vybrat</Link>
        </div>
      </Card>
    );
  }
  const tips = premium ? p.tips : p.tips.slice(0, 1);
  return (
    <Card title={<span className="flex items-center gap-2">{p.emoji} Pro vás: {p.label}</span>} action={<Link href="/nastaveni#situace" className="text-xs text-gold">Změnit</Link>}>
      <ul className="space-y-1.5 text-sm text-ink-2">{tips.map((t) => <li key={t} className="flex gap-2"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold" />{t}</li>)}</ul>
      {!premium && p.tips.length > 1 && <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3"><Crown className="h-3.5 w-3.5 text-gold" />Dalších {p.tips.length - 1} tipů a balíček „{p.label}“ v <Link href="/premium" className="text-gold underline">Premium</Link></p>}
    </Card>
  );
}
