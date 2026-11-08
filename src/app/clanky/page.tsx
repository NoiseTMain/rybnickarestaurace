import Link from "next/link";
import { PublicShell } from "@/components/PublicShell";
import { ARTICLES } from "@/lib/articles";

export const metadata = { title: "Články o osobních financích", description: "Rozpočet, rezerva, dluhy, hypotéka, předplatná, kapesné a daně OSVČ – srozumitelně a prakticky.", robots: { index: true, follow: true }, alternates: { canonical: "/clanky" } };

export default function ArticlesPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Články o penězích</h1>
        <p className="text-sm text-ink-2">Krátce a prakticky. Spočítat si to můžete v <Link href="/kalkulacky" className="text-gold underline">kalkulačkách</Link>.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link href={`/clanky/${a.slug}`} className="glass block h-full rounded-3xl p-5 transition hover:bg-white/[0.06]">
                <p className="text-2xl" aria-hidden>{a.emoji}</p>
                <h2 className="mt-1 font-semibold">{a.title}</h2>
                <p className="mt-1 text-sm text-ink-3">{a.description}</p>
                <p className="mt-2 text-xs text-ink-3">{a.minutes} min čtení</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </PublicShell>
  );
}
