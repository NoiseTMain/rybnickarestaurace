"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

export type GalleryItem = { id: string; url: string; alt: string; category: string; spaceSlug: string | null; width: number | null; height: number | null };

export function Gallery({
  items,
  categories,
  spaces = [],
  initialFilter = "vse",
  showFilters = true,
}: {
  items: GalleryItem[];
  categories: { key: string; label: string }[];
  spaces?: { slug: string; name: string }[];
  initialFilter?: string;
  showFilters?: boolean;
}) {
  const [filter, setFilter] = useState(initialFilter);
  const [index, setIndex] = useState(-1);

  const visible = useMemo(
    () =>
      filter === "vse"
        ? items
        : items.filter((i) => i.category === filter || (filter.startsWith("prostor:") && i.spaceSlug === filter.slice(8))),
    [items, filter],
  );

  const usedCategories = categories.filter((c) => items.some((i) => i.category === c.key));
  const usedSpaces = spaces.filter((s) => items.some((i) => i.spaceSlug === s.slug));

  if (!items.length) {
    return (
      <div className="card px-6 py-14 text-center">
        <p className="font-display text-2xl text-pond-950">Fotografie připravujeme</p>
        <p className="mt-2 text-ink-soft">Brzy zde najdete fotografie restaurace, jídel a prostor.</p>
      </div>
    );
  }

  const chip = (key: string, label: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={filter === key}
      onClick={() => setFilter(key)}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        filter === key ? "border-pond-900 bg-pond-900 text-paper" : "border-line bg-white text-ink-soft hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      {showFilters && usedCategories.length + usedSpaces.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filtrovat fotografie">
          {chip("vse", "Vše")}
          {usedCategories.map((c) => chip(c.key, c.label))}
          {usedSpaces.map((s) => chip(`prostor:${s.slug}`, s.name))}
        </div>
      )}
      <ul className="columns-2 gap-3 sm:gap-4 md:columns-3 lg:columns-4">
        {visible.map((item, i) => (
          <li key={item.id} className="mb-3 break-inside-avoid sm:mb-4">
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="group block w-full overflow-hidden rounded-xl bg-cream"
              aria-label={`Zvětšit fotografii${item.alt ? `: ${item.alt}` : ""}`}
            >
              <Image
                src={item.url}
                alt={item.alt}
                width={item.width ?? 1200}
                height={item.height ?? 900}
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                className="h-auto w-full transition duration-500 group-hover:scale-[1.03]"
              />
            </button>
          </li>
        ))}
      </ul>
      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={visible.map((i) => ({ src: i.url, alt: i.alt, width: i.width ?? undefined, height: i.height ?? undefined }))}
        plugins={[Zoom]}
        labels={{ Close: "Zavřít", Previous: "Předchozí", Next: "Další" }}
        styles={{ container: { backgroundColor: "rgba(13, 33, 29, 0.96)" } }}
      />
    </div>
  );
}
