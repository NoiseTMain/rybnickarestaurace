import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, ImageIcon, UsersIcon } from "@/components/ui/icons";
import { publicFileUrl } from "@/lib/storage";
import type { GalleryPhoto, Space } from "@/lib/types";

export function spaceCover(space: Space, photos: GalleryPhoto[]): string | null {
  return publicFileUrl("media", space.cover_path ?? photos.find((p) => p.space_id === space.id)?.storage_path);
}

export function SpacesGrid({ spaces, photos, headingLevel = "h3" }: { spaces: Space[]; photos: GalleryPhoto[]; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {spaces.map((space, i) => {
        const cover = spaceCover(space, photos);
        const count = photos.filter((p) => p.space_id === space.id).length;
        return (
          <li
            key={space.id}
            id={space.slug}
            className={`card group flex scroll-mt-28 flex-col overflow-hidden ${i === 0 ? "lg:col-span-2 lg:row-span-1" : ""}`}
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-pond-900">
              {cover ? (
                <Image
                  src={cover}
                  alt={space.name}
                  fill
                  sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="ripple-bg flex h-full items-center justify-center text-paper/40">
                  <span className="font-display text-3xl text-paper/70">{space.name}</span>
                </div>
              )}
              {count > 0 && (
                <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">
                  <ImageIcon size={14} /> {count}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-6">
              <H className="font-display text-2xl font-semibold text-pond-950">{space.name}</H>
              {space.description && <p className="mt-2 flex-1 leading-relaxed text-ink-soft">{space.description}</p>}
              {(space.capacity || space.capacity_note) && (
                <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-pond-800">
                  <UsersIcon size={18} className="text-amber-600" />
                  {space.capacity ? `až ${space.capacity} osob` : null}
                  {space.capacity && space.capacity_note ? " · " : null}
                  {space.capacity_note && <span className="font-normal text-ink-soft">{space.capacity_note}</span>}
                </p>
              )}
              {count > 0 && (
                <Link href={`/galerie?prostor=${space.slug}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-pond-700 hover:text-pond-900">
                  Fotografie prostoru <ArrowRightIcon size={16} />
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
