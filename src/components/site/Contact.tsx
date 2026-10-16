import Link from "next/link";
import { MailIcon, PhoneIcon, PinIcon, RouteIcon } from "@/components/ui/icons";
import { fullAddress, mapLinks, telHref } from "@/lib/format";
import type { SiteSettings } from "@/lib/types";
import { MapEmbed } from "./MapEmbed";
import { OpenNowBadge, OpeningHours } from "./OpeningHours";

export function ContactDetails({ settings }: { settings: SiteSettings }) {
  const links = mapLinks(settings);
  const tel = telHref(settings.phone);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
      <div className="space-y-6">
        <ul className="grid gap-3">
          <li>
            <a href={tel} className="card flex items-center gap-4 p-5 transition hover:border-pond-500">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500 text-pond-950">
                <PhoneIcon size={22} />
              </span>
              <span>
                <span className="block text-sm text-ink-soft">Telefon – rezervace a jídlo s sebou</span>
                <span className="font-display text-2xl font-semibold text-pond-950">{settings.phone}</span>
              </span>
            </a>
          </li>
          <li>
            <a href={`mailto:${settings.email}`} className="card flex items-center gap-4 p-5 transition hover:border-pond-500">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pond-100 text-pond-800">
                <MailIcon size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-ink-soft">E-mail</span>
                <span className="block font-semibold break-all text-pond-950">{settings.email}</span>
              </span>
            </a>
          </li>
          <li className="card flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pond-100 text-pond-800">
              <PinIcon size={22} />
            </span>
            <span>
              <span className="block text-sm text-ink-soft">Adresa</span>
              <span className="font-semibold text-pond-950">{fullAddress(settings)}</span>
            </span>
          </li>
        </ul>

        <div className="card p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-xl font-semibold text-pond-950">Otevírací doba</h3>
            <OpenNowBadge hours={settings.opening_hours} />
          </div>
          <div className="-mx-3">
            <OpeningHours hours={settings.opening_hours} note={settings.opening_hours_note} />
          </div>
        </div>
        {settings.texts.contact_note && <p className="text-ink-soft">{settings.texts.contact_note}</p>}
      </div>

      <div className="space-y-4">
        <MapEmbed embedUrl={links.embed} title={`Mapa – ${settings.restaurant_name}`} />
        <div className="grid gap-3 sm:grid-cols-2">
          <a href={links.directions} target="_blank" rel="noopener" className="btn btn-dark">
            <RouteIcon size={18} /> Navigovat
          </a>
          <Link href="/rezervace" className="btn btn-outline">
            Rezervace a poptávky
          </Link>
        </div>
      </div>
    </div>
  );
}
