import { publicEnv } from "@/lib/env";
import { publicFileUrl } from "@/lib/storage";
import type { SiteSettings } from "@/lib/types";

/** URL originálního loga (nahraného v administraci nebo uloženého v /public). */
export function logoUrl(settings: Pick<SiteSettings, "logo_path">): string | null {
  return publicFileUrl("media", settings.logo_path) ?? (publicEnv.logoPath || null);
}

/**
 * Originální logo restaurace. Dokud logo není nahrané, zobrazí se pouze
 * název restaurace písmem – nejde o náhradní logo, jen o textový název.
 */
export function Logo({
  url,
  name,
  className = "h-12",
  textClassName = "text-xl",
}: {
  url: string | null;
  name: string;
  className?: string;
  textClassName?: string;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- originální soubor loga bez přepočtu (SVG/PNG v plné kvalitě)
    return <img src={url} alt={name} className={`${className} w-auto object-contain`} decoding="async" />;
  }
  return <span className={`font-display font-semibold leading-none tracking-tight ${textClassName}`}>{name}</span>;
}
