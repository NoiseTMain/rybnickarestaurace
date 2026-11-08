"use client";
import { Camera, Loader2, Minus, Pencil, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCustomToList, deleteCustomRecipe, saveCustomRecipe } from "@/lib/actions/recipes";
import { uploadDocument } from "@/lib/upload-client";
import type { CustomRecipe } from "@/lib/db/types";
import { COURSES } from "@/lib/recipes/bases";
import { scaleAmount } from "@/lib/recipes/custom";
import { phrase } from "@/lib/i18n/phrase";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { FormActions } from "@/components/forms/common";

/** Fotka jídla – vyfotit mobilem nebo nahrát z galerie. */
function RecipePhoto({ docId, setDocId }: { docId: string | null; setDocId: (v: string | null) => void }) {
  const lk = useLookups();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <input type="hidden" name="photo_document_id" value={docId ?? ""} />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        {docId ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/files/${docId}`} alt="Fotka jídla" className="aspect-[4/3] w-full object-cover" />
            <button type="button" onClick={() => setDocId(null)} className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-ink hover:bg-black" aria-label="Odebrat fotku"><X className="h-4 w-4" /></button>
          </>
        ) : (
          <label className="flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-2 text-sm text-ink-2 hover:text-ink">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6 text-gold" />}
            <span>{busy ? "Nahrávám…" : "Vyfotit jídlo nebo nahrát fotku"}</span>
            <input type="file" accept="image/*" className="sr-only" disabled={busy} data-testid="recipe-photo-input" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true); setErr(null);
              try { setDocId(await uploadDocument(f, "other", lk, "Fotka receptu")); } catch (x) { setErr(x instanceof Error ? x.message : "Nahrání selhalo"); }
              setBusy(false);
              e.target.value = "";
            }} />
          </label>
        )}
      </div>
      {err && <p className="mt-1 text-xs text-neg">{err}</p>}
    </div>
  );
}

export function CustomRecipeForm({ initial, onDone }: { initial?: CustomRecipe; onDone?: () => void }) {
  const router = useRouter();
  const { state, formAction, pending, fe } = useFormAction(saveCustomRecipe, (r) => { onDone?.(); if (!initial && r.id) router.push(`/recepty/vlastni/${r.id}`); });
  const [docId, setDocId] = useState<string | null>(initial?.photo_document_id ?? null);
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <RecipePhoto docId={docId} setDocId={setDocId} />
      <Input name="title" label="Název receptu" placeholder="např. Babiččiny bramboráky" defaultValue={initial?.title ?? ""} error={fe("title")} required />
      <div className="grid grid-cols-3 gap-3">
        <Select name="course" label="Kategorie" defaultValue={initial?.course ?? "hlavni"} error={fe("course")}>
          {Object.entries(COURSES).map(([k, c]) => <option key={k} value={k}>{c.emoji} {phrase(c.label)}</option>)}
        </Select>
        <Input name="servings" type="number" inputMode="numeric" min={1} max={20} label="Porcí" defaultValue={initial?.servings ?? 2} error={fe("servings")} />
        <Input name="time_min" type="number" inputMode="numeric" min={1} label="Minut" placeholder="30" defaultValue={initial?.time_min ?? ""} error={fe("time_min")} />
      </div>
      <Textarea name="ingredients" label="Suroviny (jedna na řádek)" rows={6} placeholder={"500 g brambor\n1 vejce\n2 lžíce hladké mouky\n2 stroužky česneku\nmajoránka, sůl"} defaultValue={initial?.ingredients.map((i) => `${i.amount ? `${i.amount} ` : ""}${i.name}`).join("\n") ?? ""} error={fe("ingredients")} required />
      <Textarea name="steps" label="Postup (každý krok na nový řádek)" rows={6} defaultValue={initial?.steps ?? ""} error={fe("steps")} />
      <div className="grid grid-cols-2 gap-3">
        <Input name="kcal" type="number" inputMode="numeric" min={0} label="Kalorie na porci (nepovinné)" defaultValue={initial?.kcal ?? ""} error={fe("kcal")} />
      </div>
      <Textarea name="note" label="Poznámka (nepovinné)" defaultValue={initial?.note ?? ""} error={fe("note")} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel={initial ? "Uložit změny" : "Uložit recept"} />
    </form>
  );
}

export function CustomRecipeButton({ initial, label }: { initial?: CustomRecipe; label?: string }) {
  return <ModalButton label={label ?? (initial ? "Upravit" : "Přidat vlastní recept")} variant={initial ? "secondary" : "primary"} size="sm" icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit recept" : "Vlastní recept"} render={(close) => <CustomRecipeForm initial={initial} onDone={close} />} />;
}

/** Suroviny s přepočtem porcí a přidáním do nákupního seznamu. */
export function CustomIngredients({ r, lists }: { r: CustomRecipe; lists: { id: string; name: string }[] }) {
  const [n, setN] = useState(r.servings);
  const [list, setList] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2 text-sm">
        <button type="button" aria-label="Méně porcí" onClick={() => setN((x) => Math.max(1, x - 1))} className="rounded-full border border-white/10 p-1"><Minus className="h-3.5 w-3.5" /></button>
        <span className="w-16 text-center">{n} {n === 1 ? "porce" : n < 5 ? "porce" : "porcí"}</span>
        <button type="button" aria-label="Více porcí" onClick={() => setN((x) => Math.min(20, x + 1))} className="rounded-full border border-white/10 p-1"><Plus className="h-3.5 w-3.5" /></button>
      </div>
      <ul className="space-y-1 text-sm">{r.ingredients.map((i, k) => <li key={k} className="flex justify-between gap-2 border-t border-white/[0.06] py-1.5 first:border-0"><span>{i.name}</span><span className="num text-ink-2">{scaleAmount(i.amount, n / r.servings)}</span></li>)}</ul>
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <select className="field !h-10 text-sm" aria-label="Nákupní seznam" value={list} onChange={(e) => setList(e.target.value)}>
          <option value="">Nový nákupní seznam</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <Button type="button" variant="primary" className="w-full justify-center" loading={pending} icon={<ShoppingCart className="h-4 w-4" />} onClick={() => start(async () => {
          const res = await addCustomToList(r.id, n, list || null);
          if (res.ok) { toast(res.message ?? "Přidáno"); router.push("/planovani"); } else toast(res.error ?? "Nepovedlo se", "error");
        })}>Do nákupního seznamu</Button>
      </div>
    </div>
  );
}

export function DeleteCustomRecipe({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button type="button" size="sm" variant="ghost" loading={pending} icon={<Trash2 className="h-4 w-4" />} onClick={() => {
      if (!confirm("Opravdu smazat tento recept?")) return;
      start(async () => { const r = await deleteCustomRecipe(id); if (r.ok) { toast(r.message ?? ""); router.push("/recepty?pohled=vlastni"); } else toast(r.error ?? "Chyba", "error"); });
    }}>Smazat</Button>
  );
}
