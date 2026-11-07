import { Lock } from "lucide-react";
import { LinkButton } from "./Button";

/** Obsah sekcí pro podnikání (faktury, práce na IČO) je dostupný až po aktivaci IČO. */
export function IcoLocked({ what }: { what: string }) {
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-[var(--radius-card)] px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 text-gold"><Lock className="h-6 w-6" /></span>
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Aktivujte IČO</h2>
      <p className="max-w-md text-sm text-ink-2">{what} je určená pro podnikání na IČO. Po aktivaci a ověření IČO v registru ARES se zobrazí veškerý obsah.</p>
      <LinkButton href="/nastaveni#ico" variant="primary">Aktivovat IČO</LinkButton>
    </div>
  );
}
