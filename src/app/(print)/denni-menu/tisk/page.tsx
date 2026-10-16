import type { Metadata } from "next";
import Link from "next/link";
import { publicFileUrl } from "@/lib/storage";
import { getCurrentMenu } from "@/lib/data/public";
import { formatMenuDate } from "@/lib/time";
import { PrintTrigger } from "./PrintTrigger";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tisk denního menu", robots: { index: false } };

/** Samostatná stránka pro tisk – menu přes celou stránku A4, bez navigace. */
export default async function PrintMenuPage() {
  const menu = await getCurrentMenu();
  const url = menu ? publicFileUrl("menus", menu.storage_path) : null;
  if (!menu || !url) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-display text-3xl">Dnešní menu připravujeme</p>
        <Link href="/" className="btn btn-dark">Zpět na web</Link>
      </main>
    );
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col items-center p-4 print:block print:max-w-none print:p-0">
      <style>{`@page { size: auto; margin: 8mm; } @media print { img { max-height: 100vh; } }`}</style>
      <div className="no-print mb-4 flex w-full items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Menu – {formatMenuDate(menu.menu_date)}</p>
        <PrintTrigger />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- originální PNG pro tisk */}
      <img src={url} alt={`Denní menu – ${formatMenuDate(menu.menu_date)}`} className="mx-auto block h-auto max-w-full object-contain" />
    </main>
  );
}
