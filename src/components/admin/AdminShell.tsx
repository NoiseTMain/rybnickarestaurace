"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BurgerIcon, CloseIcon } from "@/components/ui/icons";
import { Logo } from "@/components/site/Logo";

const NAV = [
  { href: "/admin", label: "Přehled" },
  { href: "/admin/menu/nahrat", label: "Nahrát menu" },
  { href: "/admin/menu/historie", label: "Historie menu" },
  { href: "/admin/nabidka", label: "Jídla a nápoje" },
  { href: "/admin/prostory", label: "Prostory" },
  { href: "/admin/sport", label: "Sportovní přenosy" },
  { href: "/admin/galerie", label: "Fotografie" },
  { href: "/admin/poptavky", label: "Poptávky" },
  { href: "/admin/nastaveni", label: "Nastavení" },
];

export function AdminShell({
  children,
  logo,
  name,
  userEmail,
  signOut,
  newInquiries,
}: {
  children: React.ReactNode;
  logo: string | null;
  name: string;
  userEmail: string;
  signOut: () => Promise<void>;
  newInquiries: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <ul className="grid gap-1">
      {NAV.map((n) => (
        <li key={n.href}>
          <Link
            href={n.href}
            onClick={() => setOpen(false)}
            aria-current={isActive(n.href) ? "page" : undefined}
            className={`flex items-center justify-between rounded-xl px-4 py-3 text-[0.95rem] font-medium transition ${
              isActive(n.href) ? "bg-pond-900 text-paper" : "text-ink hover:bg-white"
            }`}
          >
            {n.label}
            {n.href === "/admin/poptavky" && newInquiries > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-pond-950">{newInquiries}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );

  const footer = (
    <div className="mt-6 border-t border-line pt-4 text-sm">
      <p className="truncate text-ink-soft" title={userEmail}>{userEmail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/" target="_blank" className="btn btn-outline !min-h-10 !px-4 !text-sm">Zobrazit web</Link>
        <form action={signOut}>
          <button className="btn btn-outline !min-h-10 !px-4 !text-sm">Odhlásit</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r border-line bg-[#ece7dc] p-5 lg:block">
        <Link href="/admin" className="mb-6 flex items-center gap-3 px-2 text-pond-900">
          <Logo url={logo} name={name} className="h-12" textClassName="text-xl" />
        </Link>
        <nav aria-label="Administrace">{nav}</nav>
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-[#ece7dc]/95 px-4 backdrop-blur lg:hidden">
        <Link href="/admin" className="flex items-center text-pond-900">
          <Logo url={logo} name={name} className="h-10" textClassName="text-lg" />
        </Link>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white"
          aria-expanded={open}
          aria-label={open ? "Zavřít nabídku" : "Otevřít nabídku"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseIcon size={22} /> : <BurgerIcon size={22} />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-30 overflow-y-auto bg-[#ece7dc] p-4 lg:hidden">
          <nav aria-label="Administrace">{nav}</nav>
          {footer}
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
