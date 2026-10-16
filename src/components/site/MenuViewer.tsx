"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import Lightbox from "yet-another-react-lightbox";
import Download from "yet-another-react-lightbox/plugins/download";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { CalendarIcon, DownloadIcon, PrintIcon, ZoomIcon } from "@/components/ui/icons";
import { formatMenuDate, pragueToday } from "@/lib/time";

export type MenuView = {
  id: string;
  menuDate: string;
  url: string;
  downloadUrl: string;
  downloadName: string;
  width: number | null;
  height: number | null;
};

type DayState = "today" | "past" | "future";

const noopSubscribe = () => () => {};

function dayState(menuDate: string, today: string): DayState {
  return menuDate === today ? "today" : menuDate < today ? "past" : "future";
}

/** Zobrazení PNG menu: ostré, bez deformace, se zvětšením, stažením a tiskem. */
export function MenuViewer({ menu, serverToday, compact = false }: { menu: MenuView | null; serverToday: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [showLast, setShowLast] = useState(false);
  // Stránka může být z cache – „dnešek“ se po načtení ověří i v prohlížeči (pražský čas).
  const today = useSyncExternalStore(noopSubscribe, pragueToday, () => serverToday);
  const state: DayState | null = menu ? dayState(menu.menuDate, today) : null;

  if (!menu || (state === "past" && !showLast)) {
    return (
      <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center sm:py-20">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cream text-amber-700">
          <CalendarIcon size={30} />
        </span>
        <p className="font-display text-2xl font-semibold text-pond-950 sm:text-3xl">Dnešní menu připravujeme</p>
        <p className="max-w-md text-ink-soft">Menu zveřejňujeme každý den. Zkuste to prosím o něco později, nebo nám zavolejte.</p>
        {menu && state === "past" && (
          <button type="button" className="btn btn-outline mt-2" onClick={() => setShowLast(true)}>
            Zobrazit poslední menu ({formatMenuDate(menu.menuDate, { year: false })})
          </button>
        )}
      </div>
    );
  }

  const label =
    state === "today"
      ? `Dnes, ${formatMenuDate(menu.menuDate)}`
      : state === "future"
        ? `Menu na ${formatMenuDate(menu.menuDate)}`
        : `Poslední zveřejněné menu – ${formatMenuDate(menu.menuDate)}`;

  return (
    <figure className="mx-auto w-full max-w-3xl">
      <figcaption className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
            state === "past" ? "bg-cream text-ink-soft" : "bg-pond-900 text-paper"
          }`}
        >
          <CalendarIcon size={17} className={state === "past" ? "" : "text-amber-300"} />
          <span className="first-letter:uppercase">{label}</span>
        </span>
        <span className="text-xs text-ink-soft">Klepnutím menu zvětšíte</span>
      </figcaption>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-[var(--shadow-lift)] sm:p-3"
        aria-label="Zvětšit denní menu"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- originální PNG bez rekomprese kvůli ostrosti textu */}
        <img
          src={menu.url}
          alt={`Denní menu – ${formatMenuDate(menu.menuDate)}`}
          width={menu.width ?? undefined}
          height={menu.height ?? undefined}
          className="block h-auto w-full rounded-xl"
          decoding="async"
          fetchPriority="high"
        />
        <span className="pointer-events-none absolute right-5 bottom-5 inline-flex items-center gap-2 rounded-full bg-pond-950/85 px-3 py-2 text-xs font-semibold text-paper opacity-90 transition group-hover:opacity-100">
          <ZoomIcon size={16} /> Zvětšit
        </span>
      </button>

      {!compact && (
        <div className="mt-5 grid grid-cols-3 gap-2 sm:flex sm:justify-center sm:gap-3">
          <button type="button" className="btn btn-dark !px-3 sm:!px-5" onClick={() => setOpen(true)}>
            <ZoomIcon size={18} /> <span>Zvětšit</span>
          </button>
          <a className="btn btn-outline !px-3 sm:!px-5" href={menu.downloadUrl} download={menu.downloadName}>
            <DownloadIcon size={18} /> <span>Stáhnout</span>
          </a>
          <a className="btn btn-outline !px-3 sm:!px-5" href="/denni-menu/tisk" target="_blank" rel="noopener">
            <PrintIcon size={18} /> <span>Tisk</span>
          </a>
        </div>
      )}

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        slides={[
          {
            src: menu.url,
            alt: "Denní menu",
            width: menu.width ?? undefined,
            height: menu.height ?? undefined,
            download: { url: menu.downloadUrl, filename: menu.downloadName },
          },
        ]}
        plugins={[Zoom, Download]}
        zoom={{ maxZoomPixelRatio: 4, scrollToZoom: true, doubleClickMaxStops: 3 }}
        carousel={{ finite: true }}
        render={{ buttonPrev: () => null, buttonNext: () => null }}
        labels={{ Close: "Zavřít", "Zoom in": "Přiblížit", "Zoom out": "Oddálit", Download: "Stáhnout" }}
        styles={{ container: { backgroundColor: "rgba(13, 33, 29, 0.96)" } }}
      />
    </figure>
  );
}

/** Po zveřejnění nového menu se otevřená stránka sama obnoví. */
export function MenuAutoRefresh({ currentId }: { currentId: string | null }) {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/menu/current", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { id: string | null };
        if (!stopped && data.id !== currentId) router.refresh();
      } catch {
        /* offline – zkusíme příště */
      }
    };
    const interval = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, [currentId, router]);
  return null;
}
