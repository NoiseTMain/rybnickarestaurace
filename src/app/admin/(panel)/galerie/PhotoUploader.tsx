"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusMessage, type ActionState } from "@/components/admin/ui";
import { uploadMedia } from "@/lib/image-upload";
import { GALLERY_CATEGORIES } from "@/lib/types";
import { registerPhotos } from "../../actions";

export function PhotoUploader({ spaces }: { spaces: { id: string; name: string }[] }) {
  const router = useRouter();
  const [category, setCategory] = useState("restaurace");
  const [spaceId, setSpaceId] = useState("");
  const [alt, setAlt] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [state, setState] = useState<ActionState>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setState(null);
    const uploaded: { path: string; width: number; height: number; alt: string }[] = [];
    const errors: string[] = [];
    for (const [i, file] of [...files].entries()) {
      setProgress(`Zpracovávám a nahrávám ${i + 1} z ${files.length}…`);
      try {
        const res = await uploadMedia("gallery", file, { optimize: true });
        uploaded.push({ ...res, alt });
      } catch (e) {
        errors.push(`${file.name}: ${e instanceof Error ? e.message : "chyba"}`);
      }
    }
    setProgress(null);
    if (uploaded.length) {
      const result = await registerPhotos(uploaded, category, spaceId || null);
      setState(errors.length && result ? { ok: false, message: `${result.message} Nepodařilo se: ${errors.join("; ")}` } : result);
      router.refresh();
    } else {
      setState({ ok: false, message: errors.join("; ") || "Nic nebylo nahráno." });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="up-cat">Kategorie</label>
          <select id="up-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="field">
            {GALLERY_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="up-space">Prostor (nepovinné)</label>
          <select id="up-space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className="field">
            <option value="">—</option>
            {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="up-alt">Popis fotografie</label>
          <input id="up-alt" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} placeholder="např. Sál připravený na oslavu" className="field" />
        </div>
      </div>
      <label className={`btn btn-primary w-full cursor-pointer sm:w-auto ${progress ? "pointer-events-none opacity-60" : ""}`}>
        {progress ?? "Vybrat fotografie"}
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onFiles(e.target.files)} disabled={!!progress} />
      </label>
      <p className="text-xs text-ink-soft">Fotografie se před nahráním automaticky zmenší (max. 2400 px) pro rychlé načítání webu.</p>
      <StatusMessage state={state} />
    </div>
  );
}
