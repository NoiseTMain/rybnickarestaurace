"use client";

import { useState } from "react";
import { PinIcon } from "@/components/ui/icons";

/** Mapa se načte až po kliknutí – bez cookies třetích stran při běžné návštěvě. */
export function MapEmbed({ embedUrl, title }: { embedUrl: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-pond-50 sm:aspect-[16/10]">
      {loaded ? (
        <iframe
          src={embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_30%_30%,var(--color-pond-100),var(--color-pond-50))] p-6 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-pond-900 text-amber-300 shadow-lg">
            <PinIcon size={26} />
          </span>
          <span className="font-semibold text-pond-900">Zobrazit mapu</span>
          <span className="max-w-xs text-xs text-ink-soft">Po kliknutí se načte mapa od Google, která může používat cookies.</span>
        </button>
      )}
    </div>
  );
}
