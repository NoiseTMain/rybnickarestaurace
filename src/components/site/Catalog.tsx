import { formatPrice } from "@/lib/format";
import type { CategoryWithItems } from "@/lib/types";

export function CatalogList({ categories, emptyText }: { categories: CategoryWithItems[]; emptyText: string }) {
  if (!categories.length) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-display text-2xl text-pond-950">{emptyText}</p>
        <p className="mt-2 text-ink-soft">Aktuální nabídku vám rádi sdělíme na místě nebo telefonicky.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-x-14 gap-y-12 lg:grid-cols-2">
      {categories.map((cat) => (
        <section key={cat.id} aria-labelledby={`cat-${cat.id}`} className="break-inside-avoid">
          <h3 id={`cat-${cat.id}`} className="flex items-center gap-3 font-display text-2xl font-semibold text-pond-900">
            {cat.name}
            <span className="h-px flex-1 bg-line" aria-hidden />
          </h3>
          {cat.description && <p className="mt-2 text-sm text-ink-soft">{cat.description}</p>}
          <ul className="mt-5 space-y-5">
            {cat.items.map((item) => {
              const price = formatPrice(item.price);
              return (
                <li key={item.id}>
                  <div className="flex items-end gap-3">
                    <p className="font-semibold text-ink">
                      {item.portion && <span className="mr-2 text-sm font-medium whitespace-nowrap text-amber-700">{item.portion}</span>}
                      {item.name}
                    </p>
                    <span className="dot-leader" aria-hidden />
                    <p className="font-display text-lg font-semibold whitespace-nowrap text-pond-900 tabular-nums">
                      {price ?? item.price_note ?? ""}
                    </p>
                  </div>
                  {(item.description || item.allergens || (price && item.price_note)) && (
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                      {item.description}
                      {price && item.price_note && <span className="italic"> {item.price_note}</span>}
                      {item.allergens && (
                        <span className="ml-1 whitespace-nowrap text-xs text-ink-soft/80" title="Alergeny">
                          (alergeny: {item.allergens})
                        </span>
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
