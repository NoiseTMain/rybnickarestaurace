import Link from "next/link";
import { MenuBookIcon, PhoneIcon, RouteIcon } from "@/components/ui/icons";

/** Spodní panel na mobilu: Zavolat · Denní menu · Trasa */
export function MobileActionBar({ tel, directions }: { tel: string; directions: string }) {
  const item = "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.72rem] font-semibold tracking-wide";
  return (
    <nav
      aria-label="Rychlé akce"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-pond-950/95 text-paper backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch">
        <a href={tel} className={item}>
          <PhoneIcon size={22} className="text-amber-300" />
          Zavolat
        </a>
        <Link href="/denni-menu" className={`${item} relative`}>
          <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-pond-950 shadow-lg ring-4 ring-pond-950">
            <MenuBookIcon size={24} />
          </span>
          Denní menu
        </Link>
        <a href={directions} target="_blank" rel="noopener" className={item}>
          <RouteIcon size={22} className="text-amber-300" />
          Trasa
        </a>
      </div>
    </nav>
  );
}
