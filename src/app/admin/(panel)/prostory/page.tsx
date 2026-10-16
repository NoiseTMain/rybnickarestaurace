import { ActionForm, PageTitle, Panel, SubmitButton } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { publicFileUrl } from "@/lib/storage";
import type { GalleryPhoto, Space } from "@/lib/types";
import { createSpace, deleteSpace, saveSpace } from "../../actions";

export const metadata = { title: "Prostory" };

export default async function SpacesAdminPage() {
  const { supabase } = await requireAdmin();
  const [{ data: spaces }, { data: photos }] = await Promise.all([
    supabase.from("spaces").select("*").order("sort_order"),
    supabase.from("gallery_photos").select("id,storage_path,alt,space_id").order("created_at", { ascending: false }),
  ]);
  const list = (spaces ?? []) as Space[];
  const gallery = (photos ?? []) as Pick<GalleryPhoto, "id" | "storage_path" | "alt" | "space_id">[];

  return (
    <>
      <PageTitle
        title="Prostory"
        intro="Výčep, salonky, sál a zahrádka. Kapacitu vyplňte jen tehdy, je-li ověřená – prázdná kapacita se na webu nezobrazí. Fotografie přiřadíte prostoru v sekci Fotografie."
      />
      <div className="space-y-5">
        {list.map((sp) => {
          const own = gallery.filter((g) => g.space_id === sp.id);
          return (
            <Panel key={sp.id} title={sp.name}>
              <ActionForm action={saveSpace} className="grid gap-4 sm:grid-cols-6">
                <input type="hidden" name="id" value={sp.id} />
                <div className="sm:col-span-4">
                  <label className="field-label" htmlFor={`n-${sp.id}`}>Název</label>
                  <input id={`n-${sp.id}`} name="name" defaultValue={sp.name} required className="field" />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor={`o-${sp.id}`}>Pořadí</label>
                  <input id={`o-${sp.id}`} name="sort_order" type="number" defaultValue={sp.sort_order} className="field" />
                </div>
                <div className="sm:col-span-6">
                  <label className="field-label" htmlFor={`d-${sp.id}`}>Popis</label>
                  <textarea id={`d-${sp.id}`} name="description" defaultValue={sp.description ?? ""} rows={3} maxLength={1500} className="field" />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor={`c-${sp.id}`}>Kapacita (osob)</label>
                  <input id={`c-${sp.id}`} name="capacity" type="number" min={1} defaultValue={sp.capacity ?? ""} className="field" />
                </div>
                <div className="sm:col-span-4">
                  <label className="field-label" htmlFor={`cn-${sp.id}`}>Poznámka ke kapacitě</label>
                  <input id={`cn-${sp.id}`} name="capacity_note" defaultValue={sp.capacity_note ?? ""} placeholder="např. při rautu až 80 osob" className="field" />
                </div>
                <div className="sm:col-span-6">
                  <label className="field-label" htmlFor={`cv-${sp.id}`}>Titulní fotografie</label>
                  <select id={`cv-${sp.id}`} name="cover_path" defaultValue={sp.cover_path ?? ""} className="field">
                    <option value="">Automaticky (první fotografie prostoru)</option>
                    {(own.length ? own : gallery).map((g) => (
                      <option key={g.id} value={g.storage_path}>{g.alt || g.storage_path.split("/").pop()}</option>
                    ))}
                  </select>
                  {publicFileUrl("media", sp.cover_path ?? own[0]?.storage_path) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={publicFileUrl("media", sp.cover_path ?? own[0]?.storage_path)!} alt="" className="mt-3 h-28 w-44 rounded-lg object-cover" />
                  )}
                  <p className="mt-1 text-xs text-ink-soft">Fotografií přiřazených k prostoru: {own.length}</p>
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-6">
                  <input type="checkbox" name="is_visible" defaultChecked={sp.is_visible} className="h-5 w-5 accent-pond-700" /> Zobrazovat na webu
                </label>
                <div className="sm:col-span-6"><SubmitButton>Uložit prostor</SubmitButton></div>
              </ActionForm>
              <ActionForm action={deleteSpace} confirmText={`Smazat prostor „${sp.name}“?`} className="mt-3">
                <input type="hidden" name="id" value={sp.id} />
                <SubmitButton className="text-sm font-semibold text-red-800 underline" pendingText="Mažu…">Smazat prostor</SubmitButton>
              </ActionForm>
            </Panel>
          );
        })}
        <Panel title="Nový prostor">
          <ActionForm action={createSpace} resetOnSuccess className="flex flex-col gap-3 sm:flex-row">
            <input name="name" required placeholder="Název prostoru" aria-label="Název prostoru" className="field" />
            <SubmitButton className="btn btn-dark shrink-0">Přidat</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
