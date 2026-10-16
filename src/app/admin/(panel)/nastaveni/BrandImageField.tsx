"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusMessage, type ActionState } from "@/components/admin/ui";
import { uploadMedia } from "@/lib/image-upload";
import { setBrandImage } from "../../actions";

/** Nahrání originálního loga (bez úprav) nebo úvodní fotografie (zmenšené). */
export function BrandImageField({ kind, currentUrl }: { kind: "logo" | "hero"; currentUrl: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setState(null);
    try {
      const { path } = await uploadMedia(kind, file, { optimize: kind === "hero" });
      setState(await setBrandImage(kind, path));
      router.refresh();
    } catch (e) {
      setState({ ok: false, message: e instanceof Error ? e.message : "Nahrání selhalo." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(kind === "logo" ? "Odebrat logo z webu?" : "Odebrat úvodní fotografii?")) return;
    setBusy(true);
    setState(await setBrandImage(kind, null));
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUrl}
          alt={kind === "logo" ? "Aktuální logo" : "Aktuální úvodní fotografie"}
          className={kind === "logo" ? "h-24 w-auto rounded-xl border border-line bg-white p-3" : "aspect-[16/9] w-full max-w-md rounded-xl object-cover"}
        />
      ) : (
        <p className="text-sm text-ink-soft">{kind === "logo" ? "Logo zatím není nahrané – na webu se zobrazuje jen název písmem." : "Úvodní fotografie není nahraná – použije se barevné pozadí."}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <label className={`btn btn-dark cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Nahrávám…" : currentUrl ? "Nahrát jiný soubor" : "Nahrát soubor"}
          <input
            type="file"
            className="sr-only"
            accept={kind === "logo" ? "image/svg+xml,image/png,image/webp" : "image/jpeg,image/png,image/webp"}
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={busy}
          />
        </label>
        {currentUrl && (
          <button type="button" className="btn btn-outline" onClick={remove} disabled={busy}>
            Odebrat
          </button>
        )}
      </div>
      <StatusMessage state={state} />
    </div>
  );
}
