import Link from "next/link";
import { MailIcon, PhoneIcon, PinIcon } from "@/components/ui/icons";
import { fullAddress, mapLinks, telHref } from "@/lib/format";
import type { SiteSettings } from "@/lib/types";
import { NAV } from "./nav";
import { Logo } from "./Logo";
import { OpeningHours } from "./OpeningHours";

export function Footer({ settings, logo }: { settings: SiteSettings; logo: string | null }) {
  const links = mapLinks(settings);
  return (
    <footer className="no-print ripple-bg text-paper">
      <div className="container-page grid gap-12 py-16 pb-32 md:grid-cols-2 md:pb-16 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <div className="inline-flex rounded-2xl bg-paper px-4 py-3 text-pond-900">
            <Logo url={logo} name={settings.restaurant_name} className="h-14" textClassName="text-2xl" />
          </div>
          <p className="mt-5 max-w-xs text-paper/75">
            {settings.texts.hero_subtitle ?? "Česká restaurace a hospoda v Rybníkách u Dobříše."}
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg text-amber-300">Kontakt</h2>
          <ul className="mt-4 space-y-3 text-paper/85">
            <li>
              <a href={telHref(settings.phone)} className="inline-flex items-center gap-3 hover:text-white">
                <PhoneIcon size={18} className="text-amber-300" /> {settings.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${settings.email}`} className="inline-flex items-center gap-3 break-all hover:text-white">
                <MailIcon size={18} className="shrink-0 text-amber-300" /> {settings.email}
              </a>
            </li>
            <li>
              <a href={links.search} target="_blank" rel="noopener" className="inline-flex items-start gap-3 hover:text-white">
                <PinIcon size={18} className="mt-0.5 shrink-0 text-amber-300" /> {fullAddress(settings)}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-lg text-amber-300">Otevírací doba</h2>
          <div className="mt-4 -mx-3 text-sm text-paper/85">
            <OpeningHours hours={settings.opening_hours} note={settings.opening_hours_note} tone="dark" />
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg text-amber-300">Navigace</h2>
          <ul className="mt-4 grid gap-2 text-paper/85">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-white">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/rezervace" className="hover:text-white">
                Rezervace a poptávky
              </Link>
            </li>
          </ul>
          {(settings.facebook_url || settings.instagram_url) && (
            <div className="mt-6 flex gap-4 text-sm">
              {settings.facebook_url && (
                <a href={settings.facebook_url} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-white">
                  Facebook
                </a>
              )}
              {settings.instagram_url && (
                <a href={settings.instagram_url} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-white">
                  Instagram
                </a>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 pb-28 text-xs text-paper/55 sm:flex-row sm:justify-between md:pb-6">
          <p>© {new Date().getFullYear()} {settings.restaurant_name}</p>
          <p>
            <Link href="/ochrana-udaju" className="hover:text-paper">
              Ochrana osobních údajů
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
