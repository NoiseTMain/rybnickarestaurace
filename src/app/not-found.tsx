import Link from "next/link";

export default function NotFound() {
  return (
    <main className="ripple-bg flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center text-paper">
      <p className="eyebrow !text-amber-300">Chyba 404</p>
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">Tahle stránka tu není</h1>
      <p className="max-w-md text-paper/75">Možná byla přesunuta. Zkuste úvodní stránku nebo rovnou dnešní menu.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">Úvodní stránka</Link>
        <Link href="/denni-menu" className="btn btn-ghost-light">Dnešní menu</Link>
      </div>
    </main>
  );
}
