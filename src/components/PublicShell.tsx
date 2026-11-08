import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/I18n";
import { getT } from "@/lib/i18n/server";
import { getUser } from "@/lib/auth";

/** Rámec veřejných stránek (úvod, podmínky, zásady). */
export async function PublicShell({ children }: { children: ReactNode }) {
  const { t } = await getT();
  const user = await getUser().catch(() => null);
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Link href="/vitejte" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold-bright to-gold-deep font-bold text-[#1b1407]">H</span>
          <span className="font-[family-name:var(--font-display)] text-xl font-semibold">Home<span className="gold-text">OS</span></span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <LanguageSwitcher className="hidden sm:flex" />
          {user ? <Link href="/" className="rounded-full bg-gold px-4 py-1.5 font-medium text-[#1b1407]">Do aplikace</Link> : <>
            <Link href="/prihlaseni" className="rounded-full px-3 py-1.5 text-ink-2 hover:text-ink">{t("land.login")}</Link>
            <Link href="/registrace" className="rounded-full bg-gold px-4 py-1.5 font-medium text-[#1b1407]">{t("land.start")}</Link>
          </>}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">{children}</main>
      <footer className="mx-auto flex max-w-5xl flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.06] px-4 py-6 text-xs text-ink-3">
        <span>© 2026 HomeOS</span>
        <Link href="/kalkulacky" className="hover:text-ink">Kalkulačky</Link>
        <Link href="/clanky" className="hover:text-ink">Články</Link>
        <Link href="/podminky" className="hover:text-ink">{t("land.terms")}</Link>
        <Link href="/soukromi" className="hover:text-ink">{t("land.privacyPage")}</Link>
        <LanguageSwitcher className="sm:hidden" />
      </footer>
    </div>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <article className="glass mx-auto max-w-3xl space-y-4 rounded-[28px] p-6 text-sm leading-relaxed text-ink-2 sm:p-8 [&_h1]:font-[family-name:var(--font-display)] [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-ink [&_h2]:pt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_a]:text-gold [&_a]:underline">{children}</article>;
}
