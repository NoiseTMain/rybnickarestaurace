import { ActionForm, PageTitle, Panel, SubmitButton } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { publicFileUrl } from "@/lib/storage";
import { GALLERY_CATEGORIES, type GalleryPhoto, type Space } from "@/lib/types";
import { deletePhoto, updatePhoto } from "../../actions";
import { PhotoUploader } from "./PhotoUploader";

export const metadata = { title: "Fotografie" };

export default async function GalleryAdminPage() {
  const { supabase } = await requireAdmin();
  const [{ data: photos }, { data: spaces }] = await Promise.all([
    supabase.from("gallery_photos").select("*").order("sort_order").order("created_at", { ascending: false }),
    supabase.from("spaces").select("id,name").order("sort_order"),
  ]);
  const list = (photos ?? []) as GalleryPhoto[];
  const spaceList = (spaces ?? []) as Pick<Space, "id" | "name">[];

  return (
    <>
      <PageTitle title="Fotografie" intro="Fotogalerie webu. Fotografie přiřazené k prostoru se zobrazí i u daného prostoru." />
      <div className="space-y-6">
        <Panel title="Nahrát fotografie">
          <PhotoUploader spaces={spaceList} />
        </Panel>
        <Panel title={`Fotografie (${list.length})`}>
          {!list.length && <p className="text-sm text-ink-soft">Zatím nejsou nahrané žádné fotografie.</p>}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <li key={p.id} className={`rounded-2xl border border-line bg-white p-3 ${p.is_visible ? "" : "opacity-60"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicFileUrl("media", p.storage_path)!} alt={p.alt} loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />
                <ActionForm action={updatePhoto} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={p.id} />
                  <input name="alt" defaultValue={p.alt} maxLength={200} placeholder="Popis fotografie" aria-label="Popis fotografie" className="field" />
                  <div className="grid grid-cols-2 gap-2">
                    <select name="category" defaultValue={p.category} aria-label="Kategorie" className="field">
                      {GALLERY_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <select name="space_id" defaultValue={p.space_id ?? ""} aria-label="Prostor" className="field">
                      <option value="">Bez prostoru</option>
                      {spaceList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <input name="sort_order" type="number" defaultValue={p.sort_order} aria-label="Pořadí" className="field !w-24" />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="is_visible" defaultChecked={p.is_visible} className="h-5 w-5 accent-pond-700" /> Na webu
                    </label>
                  </div>
                  <SubmitButton className="btn btn-dark !min-h-10 w-full !text-sm">Uložit</SubmitButton>
                </ActionForm>
                <ActionForm action={deletePhoto} confirmText="Opravdu smazat tuto fotografii?" className="mt-2 text-center">
                  <input type="hidden" name="id" value={p.id} />
                  <SubmitButton className="text-sm font-semibold text-red-800 underline" pendingText="Mažu…">Smazat</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
