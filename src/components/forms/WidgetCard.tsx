"use client";
import { Copy, LayoutGrid } from "lucide-react";
import { useState, useTransition } from "react";
import { createWidgetLink, revokeWidgetLink } from "@/lib/actions/widget";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/** Widget na plochu telefonu přes tajný odkaz (iPhone: aplikace Zkratky; Android: widget z URL). */
export function WidgetCard() {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink-2">Na ploše telefonu uvidíte <b>„Dnes můžete utratit …“</b> a kolik zbývá do konce měsíce – bez otevírání aplikace.</p>
      {url ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2">
            <code className="min-w-0 flex-1 break-all text-xs text-gold-bright" data-testid="widget-url">{url}?format=text</code>
            <Button size="sm" variant="ghost" icon={<Copy className="h-4 w-4" />} onClick={() => { void navigator.clipboard?.writeText(`${url}?format=text`); toast("Odkaz zkopírován"); }}>Kopírovat</Button>
          </div>
          <p className="text-xs text-neg">Odkaz je tajný – kdo ho má, uvidí tato souhrnná čísla. Nikomu ho neposílejte. Ukáže se jen teď.</p>
        </div>
      ) : (
        <Button variant="secondary" loading={pending} icon={<LayoutGrid className="h-4 w-4" />} onClick={() => start(async () => { const r = await createWidgetLink(); if (r.url) setUrl(r.url); else toast(r.error ?? "Chyba", "error"); })}>Vytvořit odkaz pro widget</Button>
      )}
      <details className="rounded-xl bg-black/20 p-3">
        <summary className="cursor-pointer font-medium">📱 iPhone – návod (2 minuty)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-2">
          <li>Otevřete aplikaci <b>Zkratky</b> → <b>+</b> (nová zkratka) → pojmenujte ji „HomeOS“.</li>
          <li>Přidejte akci <b>Získat obsah URL</b> a vložte zkopírovaný odkaz.</li>
          <li>Přidejte akci <b>Zobrazit výsledek</b> (nebo „Zobrazit oznámení“).</li>
          <li>Na ploše podržte prst → <b>Upravit</b> → <b>Přidat widget</b> → <b>Zkratky</b> → vyberte „HomeOS“. Klepnutím na widget uvidíte aktuální částku.</li>
          <li>Tip: v Zkratkách → Automatizace můžete nastavit, ať se vám částka každé ráno ukáže sama.</li>
        </ol>
      </details>
      <details className="rounded-xl bg-black/20 p-3">
        <summary className="cursor-pointer font-medium">🤖 Android – návod</summary>
        <p className="mt-2 text-ink-2">Nainstalujte aplikaci pro widgety z webu (např. „HTTP Request Widget“ nebo KWGT) a jako adresu zadejte zkopírovaný odkaz. Rychlé zástupce (Zapsat výdaj, Platby…) máte také po podržení ikony HomeOS na ploše.</p>
      </details>
      <button type="button" className="text-xs text-ink-3 underline" onClick={() => start(async () => { await revokeWidgetLink(); setUrl(null); toast("Odkaz widgetu zrušen"); })}>Zrušit dosavadní odkaz widgetu</button>
    </div>
  );
}
