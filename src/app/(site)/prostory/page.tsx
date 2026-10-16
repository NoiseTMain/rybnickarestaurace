import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/Section";
import { SpacesGrid } from "@/components/site/Spaces";
import { PhoneIcon } from "@/components/ui/icons";
import { getGallery, getSiteSettings, getSpaces } from "@/lib/data/public";
import { telHref } from "@/lib/format";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Prostory a akce – pronájem sálu a salonků",
  description:
    "Pronájem sálu a salonků v Restauraci Rybníky u Dobříše – oslavy, svatby, firemní akce. Hlavní výčep, dva salonky, sál a venkovní zahrádka.",
  alternates: { canonical: "/prostory" },
};

export default async function SpacesPage() {
  const [settings, spaces, photos] = await Promise.all([getSiteSettings(), getSpaces(), getGallery()]);
  return (
    <>
      <PageHero eyebrow="Prostory a akce" title="Oslavy, setkání a akce" intro={settings.texts.spaces_intro} />
      <section className="py-12 sm:py-16">
        <div className="container-page">
          <SpacesGrid spaces={spaces} photos={photos} headingLevel="h2" />
          <div className="card mt-12 flex flex-col items-start justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <h2 className="font-display text-2xl font-semibold text-pond-950">Plánujete oslavu nebo akci?</h2>
              <p className="mt-1 text-ink-soft">Pošlete nám nezávaznou poptávku, nebo zavolejte – domluvíme prostor, menu i podrobnosti.</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/rezervace?typ=akce" className="btn btn-dark">Poptat pronájem</Link>
              <a href={telHref(settings.phone)} className="btn btn-outline">
                <PhoneIcon size={18} /> Zavolat
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
