import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell, Prose } from "@/components/PublicShell";
import { ARTICLES, articleBySlug } from "@/lib/articles";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const a = articleBySlug((await params).slug);
  if (!a) return {};
  return { title: a.title, description: a.description, robots: { index: true, follow: true }, alternates: { canonical: `/clanky/${a.slug}` }, openGraph: { title: a.title, description: a.description, type: "article" } };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = articleBySlug((await params).slug);
  if (!a) notFound();
  const others = ARTICLES.filter((x) => x.slug !== a.slug).slice(0, 3);
  return (
    <PublicShell>
      <Prose>
        <p className="text-xs"><Link href="/clanky">← Všechny články</Link></p>
        <h1>{a.emoji} {a.title}</h1>
        <p className="text-ink-3">{a.minutes} min čtení · {a.description}</p>
        {a.sections.map((s, i) => (
          <section key={i} className="space-y-2">
            {s.h && <h2>{s.h}</h2>}
            {s.p.map((t, j) => <p key={j}>{t}</p>)}
            {s.list && <ul>{s.list.map((t) => <li key={t}>{t}</li>)}</ul>}
          </section>
        ))}
        {a.cta && <p className="pt-2"><Link href={a.cta.href} className="!no-underline rounded-full bg-gold px-4 py-2 font-medium !text-[#1b1407]">{a.cta.label}</Link></p>}
        <p className="text-xs text-ink-3">Obecné informace, ne finanční, daňové ani investiční poradenství.</p>
        <h2>Další články</h2>
        <ul>{others.map((o) => <li key={o.slug}><Link href={`/clanky/${o.slug}`}>{o.title}</Link></li>)}</ul>
      </Prose>
    </PublicShell>
  );
}
