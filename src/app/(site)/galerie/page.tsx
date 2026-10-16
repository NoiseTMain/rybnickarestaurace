import type { Metadata } from "next";
import { Gallery, type GalleryItem } from "@/components/site/Gallery";
import { PageHero } from "@/components/site/Section";
import { getGallery, getSpaces } from "@/lib/data/public";
import { publicFileUrl } from "@/lib/storage";
import { GALLERY_CATEGORIES } from "@/lib/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Fotogalerie",
  description: "Fotografie Restaurace Rybníky – interiér, jídla, nápoje, salonky, sál a zahrádka.",
  alternates: { canonical: "/galerie" },
};

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ prostor?: string }> }) {
  const [{ prostor }, photos, spaces] = await Promise.all([searchParams, getGallery(), getSpaces()]);
  const items: GalleryItem[] = photos.map((p) => ({
    id: p.id,
    url: publicFileUrl("media", p.storage_path)!,
    alt: p.alt,
    category: p.category,
    spaceSlug: spaces.find((s) => s.id === p.space_id)?.slug ?? null,
    width: p.width,
    height: p.height,
  }));
  const initial = prostor && spaces.some((s) => s.slug === prostor) ? `prostor:${prostor}` : "vse";
  return (
    <>
      <PageHero eyebrow="Fotogalerie" title="Nahlédněte k nám" />
      <section className="py-12 sm:py-16">
        <div className="container-page">
          <Gallery
            key={initial}
            items={items}
            categories={[...GALLERY_CATEGORIES]}
            spaces={spaces.map((s) => ({ slug: s.slug, name: s.name }))}
            initialFilter={initial}
          />
        </div>
      </section>
    </>
  );
}
