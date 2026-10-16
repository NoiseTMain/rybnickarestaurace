"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BurgerIcon, CloseIcon, PhoneIcon } from "@/components/ui/icons";
import { Logo } from "./Logo";
import { NAV } from "./nav";


export function Header({ logo, name, phone, tel }: { logo: string | null; name: string; phone: string; tel: string }) {
  const pathname = usePathname();
  // menu je otevřené jen pro stránku, na které bylo otevřeno → po navigaci se samo zavře
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (fn: (v: boolean) => boolean) => setOpenedOn(fn(open) ? pathname : null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`no-print sticky top-0 z-40 border-b transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled || open
          ? "border-line bg-paper/95 shadow-[0_6px_20px_-16px_rgb(0_0_0/0.4)] backdrop-blur-md"
          : "border-transparent bg-paper/80 backdrop-blur-sm"
      }`}
    >
      <div className="container-page flex h-[4.5rem] items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center text-pond-900" aria-label={`${name} – úvodní stránka`}>
          <Logo url={logo} name={name} className="h-11 sm:h-12" />
        </Link>

        <nav aria-label="Hlavní navigace" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-full px-2.5 py-2 text-[0.9rem] font-medium whitespace-nowrap transition-colors xl:px-3 ${
                      active ? "bg-pond-100 text-pond-900" : "text-ink-soft hover:bg-cream hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a href={tel} className="btn btn-outline hidden !min-h-11 !px-4 whitespace-nowrap sm:inline-flex lg:!px-3 2xl:!px-4" aria-label={`Zavolat ${phone}`}>
            <PhoneIcon size={18} />
            <span className="hidden 2xl:inline">{phone}</span>
            <span className="lg:hidden">Zavolat</span>
          </a>
          <Link href="/rezervace" className="btn btn-dark hidden !min-h-11 !px-5 whitespace-nowrap md:inline-flex">
            Rezervovat
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Zavřít menu" : "Otevřít menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon size={22} /> : <BurgerIcon size={22} />}
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        hidden={!open}
        className="h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-line bg-paper lg:hidden"
      >
        <nav aria-label="Mobilní navigace" className="container-page py-6 pb-28">
          <ul className="divide-y divide-line">
            <li>
              <Link href="/" className="block py-4 font-display text-2xl text-ink">
                Úvod
              </Link>
            </li>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="block py-4 font-display text-2xl text-ink aria-[current=page]:text-pond-600"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 grid gap-3">
            <Link href="/rezervace" className="btn btn-dark w-full">
              Rezervovat stůl
            </Link>
            <a href={tel} className="btn btn-outline w-full">
              <PhoneIcon size={18} /> {phone}
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
