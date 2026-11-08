import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-semibold text-gold">404</p>
      <h1 className="text-xl font-semibold">Stránka neexistuje</h1>
      <p className="text-sm text-ink-2">Odkaz je chybný, nebo k němu nemáte přístup.</p>
      <Link href="/" className="mt-2 rounded-full bg-gold px-4 py-2 text-sm font-medium text-[#1b1407]">Zpět na přehled</Link>
    </main>
  );
}
