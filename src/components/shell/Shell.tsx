"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LogOut, Menu, X, FlaskConical } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { signOut } from "@/lib/actions/auth";
import { switchHousehold } from "@/lib/actions/household";
import { cn } from "@/components/ui/cn";
import { MOBILE_TABS, NAV } from "./nav";
import { QuickAdd } from "./QuickAdd";

interface ShellProps {
  children: ReactNode;
  email: string;
  household: { id: string; name: string; is_demo: boolean };
  households: { id: string; name: string; is_demo: boolean }[];
  mode: "supabase" | "local";
}

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold-bright to-gold-deep text-[15px] font-bold text-[#1b1407] shadow-[0_6px_20px_-6px_rgba(212,180,131,0.7)]">H</span>
      <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">Home<span className="gold-text">OS</span></span>
    </Link>
  );
}

function HouseholdSwitcher({ household, households }: Pick<ShellProps, "household" | "households">) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm hover:bg-white/[0.07]" aria-expanded={open}>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-wider text-ink-3">Domácnost</span>
          <span className="block truncate">{household.name}</span>
        </span>
        {household.is_demo && <FlaskConical className="h-4 w-4 text-warn" />}
        <ChevronDown className="h-4 w-4 text-ink-3" />
      </button>
      {open && (
        <div className="glass-strong absolute inset-x-0 top-full z-50 mt-1 rounded-2xl p-1">
          {households.map((h) => (
            <button key={h.id} type="button" disabled={pending} onClick={() => start(() => switchHousehold(h.id))} className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-white/[0.07]", h.id === household.id && "text-gold")}>
              <span className="flex-1 truncate">{h.name}</span>
              {h.is_demo && <span className="text-[10px] text-warn">DEMO</span>}
            </button>
          ))}
          <Link href="/nastaveni#domacnost" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-xs text-ink-3 hover:bg-white/[0.07]">Spravovat domácnosti…</Link>
        </div>
      )}
    </div>
  );
}

function NavList({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5" aria-label="Hlavní navigace">
      {NAV.map((n) => {
        const active = isActive(path, n.href);
        return (
          <Link key={n.href} href={n.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
            className={cn("group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition", active ? "bg-ink text-base font-medium shadow-lg" : "text-ink-2 hover:bg-white/[0.06] hover:text-ink")}>
            <n.icon className={cn("h-[18px] w-[18px]", active ? "text-base" : "text-ink-3 group-hover:text-gold")} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Shell({ children, email, household, households, mode }: ShellProps) {
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);
  const footer = (
    <div className="space-y-2 border-t border-white/[0.06] pt-3">
      {mode === "local" && <p className="rounded-xl bg-info/10 px-3 py-2 text-[11px] leading-snug text-info">Lokální režim – data jsou v souboru na tomto počítači. Pro produkci nastavte Supabase.</p>}
      <div className="flex items-center gap-2 px-1">
        <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{email}</span>
        <form action={signOut}><button className="rounded-full p-2 text-ink-3 hover:bg-white/10 hover:text-ink" aria-label="Odhlásit se" title="Odhlásit se"><LogOut className="h-4 w-4" /></button></form>
      </div>
    </div>
  );
  return (
    <div className="min-h-dvh">
      {/* desktop sidebar */}
      <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-64 flex-col gap-4 rounded-[28px] p-4 lg:flex">
        <Logo />
        <HouseholdSwitcher household={household} households={households} />
        <div className="scroll-thin -mx-1 flex-1 overflow-y-auto px-1"><NavList path={path} /></div>
        {footer}
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-base/70 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
        <Logo />
        <button type="button" onClick={() => setDrawer(true)} className="rounded-full border border-white/10 bg-white/[0.05] p-2" aria-label="Otevřít menu"><Menu className="h-5 w-5" /></button>
      </header>

      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside className="glass-strong absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))]"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}>
              <div className="flex items-center justify-between"><Logo /><button type="button" onClick={() => setDrawer(false)} className="rounded-full p-2 hover:bg-white/10" aria-label="Zavřít menu"><X className="h-5 w-5" /></button></div>
              <HouseholdSwitcher household={household} households={households} />
              <div className="scroll-thin flex-1 overflow-y-auto"><NavList path={path} onNavigate={() => setDrawer(false)} /></div>
              {footer}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="lg:pl-[17.5rem]">
        {household.is_demo && (
          <div className="mx-3 mt-3 flex items-center gap-2 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-2 text-sm text-warn lg:mr-3">
            <FlaskConical className="h-4 w-4 shrink-0" />
            <span>Prohlížíte <b>ukázkovou (DEMO) domácnost</b> s vymyšlenými daty. Vaše skutečné finance jsou oddělené.</span>
          </div>
        )}
        <div className="mx-auto hidden max-w-[1400px] justify-end px-6 pt-5 lg:flex"><QuickAdd /></div>
        <main className="mx-auto max-w-[1400px] px-4 pb-32 pt-4 sm:px-6 lg:pb-12 lg:pt-0">{children}</main>
      </div>

      {/* mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-base/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Rychlá navigace">
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map((href) => {
            const n = NAV.find((x) => x.href === href)!;
            const active = isActive(path, href);
            return (
              <Link key={href} href={href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[10px]", active ? "text-gold" : "text-ink-3")}>
                <n.icon className="h-5 w-5" />
                {{ "/": "Přehled", "/transakce": "Pohyby", "/rozpocty": "Rozpočty", "/asistent": "Asistent" }[href] ?? n.label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setDrawer(true)} className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-ink-3"><Menu className="h-5 w-5" />Více</button>
        </div>
      </nav>
      <QuickAdd floating />
    </div>
  );
}
