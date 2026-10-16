import Link from "next/link";
import { ActionForm, PageTitle, SubmitButton } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import type { CategoryWithItems, MenuItem, MenuKind } from "@/lib/types";
import { createCategory, deleteCategory, deleteItem, saveItem, updateCategory } from "../../actions";

export const metadata = { title: "Jídla a nápoje" };

export default async function CatalogAdminPage({ searchParams }: { searchParams: Promise<{ typ?: string }> }) {
  const { supabase } = await requireAdmin();
  const kind: MenuKind = (await searchParams).typ === "napoje" ? "drink" : "food";
  const { data } = await supabase
    .from("menu_categories")
    .select("*, items:menu_items(*)")
    .eq("kind", kind)
    .order("sort_order")
    .order("sort_order", { referencedTable: "menu_items" });
  const categories = (data ?? []) as CategoryWithItems[];

  return (
    <>
      <PageTitle title="Jídla a nápoje" intro="Stálá nabídka a ceny. Prázdné nebo skryté kategorie se na webu nezobrazují." />
      <div className="mb-6 inline-flex rounded-full border border-line bg-white p-1">
        {[
          ["food", "Jídelní lístek", "?typ=jidla"],
          ["drink", "Nápojový lístek", "?typ=napoje"],
        ].map(([k, label, href]) => (
          <Link key={k} href={href} className={`rounded-full px-5 py-2.5 text-sm font-semibold ${kind === k ? "bg-pond-900 text-paper" : "text-ink-soft"}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="space-y-5">
        {categories.map((cat) => (
          <section key={cat.id} className="card p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold text-pond-950">
                {cat.name}
                {!cat.is_visible && <span className="ml-2 align-middle text-sm font-sans font-medium text-amber-700">(skryto)</span>}
              </h2>
              <span className="text-sm text-ink-soft">{cat.items.length} položek</span>
            </div>

            <ul className="mt-4 divide-y divide-line">
              {cat.items.map((item) => (
                <li key={item.id} className="py-2">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-cream/60">
                      <span className={item.is_visible ? "" : "text-ink-soft line-through"}>
                        {item.portion && <span className="mr-2 text-sm text-amber-700">{item.portion}</span>}
                        {item.name}
                      </span>
                      <span className="font-semibold whitespace-nowrap">{formatPrice(item.price) ?? item.price_note ?? "—"}</span>
                    </summary>
                    <div className="mt-2 rounded-xl bg-cream/50 p-4">
                      <ItemForm categoryId={cat.id} item={item} />
                      <ActionForm action={deleteItem} confirmText={`Smazat položku „${item.name}“?`} className="mt-3">
                        <input type="hidden" name="id" value={item.id} />
                        <SubmitButton className="text-sm font-semibold text-red-800 underline" pendingText="Mažu…">Smazat položku</SubmitButton>
                      </ActionForm>
                    </div>
                  </details>
                </li>
              ))}
            </ul>

            <details className="mt-4 rounded-xl border border-dashed border-sand p-4">
              <summary className="cursor-pointer font-semibold text-pond-700">+ Přidat položku</summary>
              <div className="mt-4">
                <ItemForm categoryId={cat.id} />
              </div>
            </details>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-ink-soft">Upravit kategorii</summary>
              <ActionForm action={updateCategory} className="mt-3 grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
                <input type="hidden" name="id" value={cat.id} />
                <div>
                  <label className="field-label" htmlFor={`cn-${cat.id}`}>Název</label>
                  <input id={`cn-${cat.id}`} name="name" defaultValue={cat.name} required className="field" />
                </div>
                <div>
                  <label className="field-label" htmlFor={`cd-${cat.id}`}>Popis (nepovinné)</label>
                  <input id={`cd-${cat.id}`} name="description" defaultValue={cat.description ?? ""} className="field" />
                </div>
                <div>
                  <label className="field-label" htmlFor={`cs-${cat.id}`}>Pořadí</label>
                  <input id={`cs-${cat.id}`} name="sort_order" type="number" defaultValue={cat.sort_order} className="field" />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-3">
                  <input type="checkbox" name="is_visible" defaultChecked={cat.is_visible} className="h-5 w-5 accent-pond-700" /> Zobrazovat na webu
                </label>
                <div className="sm:col-span-3"><SubmitButton>Uložit kategorii</SubmitButton></div>
              </ActionForm>
              <ActionForm action={deleteCategory} confirmText={`Smazat kategorii „${cat.name}“ včetně všech ${cat.items.length} položek?`} className="mt-3">
                <input type="hidden" name="id" value={cat.id} />
                <SubmitButton className="text-sm font-semibold text-red-800 underline" pendingText="Mažu…">Smazat kategorii</SubmitButton>
              </ActionForm>
            </details>
          </section>
        ))}

        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-xl font-semibold text-pond-950">Nová kategorie</h2>
          <ActionForm action={createCategory} resetOnSuccess className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="kind" value={kind} />
            <input name="name" required maxLength={120} placeholder={kind === "food" ? "např. Saláty" : "např. Míchané nápoje"} aria-label="Název kategorie" className="field" />
            <SubmitButton className="btn btn-dark shrink-0">Přidat kategorii</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </>
  );
}

function ItemForm({ categoryId, item }: { categoryId: string; item?: MenuItem }) {
  const id = item?.id ?? `new-${categoryId}`;
  return (
    <ActionForm action={saveItem} resetOnSuccess={!item} className="grid gap-4 sm:grid-cols-6">
      <input type="hidden" name="category_id" value={categoryId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="sm:col-span-4">
        <label className="field-label" htmlFor={`n-${id}`}>Název *</label>
        <input id={`n-${id}`} name="name" required maxLength={200} defaultValue={item?.name} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor={`p-${id}`}>Cena v Kč</label>
        <input id={`p-${id}`} name="price" inputMode="decimal" defaultValue={item?.price?.toString().replace(".", ",") ?? ""} placeholder="např. 145" className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor={`po-${id}`}>Množství</label>
        <input id={`po-${id}`} name="portion" maxLength={40} defaultValue={item?.portion ?? ""} placeholder="150 g / 0,5 l" className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor={`a-${id}`}>Alergeny</label>
        <input id={`a-${id}`} name="allergens" maxLength={60} defaultValue={item?.allergens ?? ""} placeholder="1, 3, 7" className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor={`pn-${id}`}>Pozn. k ceně</label>
        <input id={`pn-${id}`} name="price_note" maxLength={80} defaultValue={item?.price_note ?? ""} placeholder="dle denní nabídky" className="field" />
      </div>
      <div className="sm:col-span-5">
        <label className="field-label" htmlFor={`d-${id}`}>Popis</label>
        <input id={`d-${id}`} name="description" maxLength={500} defaultValue={item?.description ?? ""} className="field" />
      </div>
      <div className="sm:col-span-1">
        <label className="field-label" htmlFor={`s-${id}`}>Pořadí</label>
        <input id={`s-${id}`} name="sort_order" type="number" defaultValue={item?.sort_order ?? ""} className="field" />
      </div>
      {item && (
        <label className="flex items-center gap-2 text-sm sm:col-span-6">
          <input type="checkbox" name="is_visible" defaultChecked={item.is_visible} className="h-5 w-5 accent-pond-700" /> Zobrazovat na webu
        </label>
      )}
      <div className="sm:col-span-6">
        <SubmitButton>{item ? "Uložit položku" : "Přidat položku"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
