import type { Metadata } from "next";
import { CatalogList } from "@/components/site/Catalog";
import { PageHero } from "@/components/site/Section";
import { getCatalog } from "@/lib/data/public";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Nápojový lístek",
  description: "Nápojový lístek Restaurace Rybníky – točené pivo, nealko, víno, káva a destiláty.",
  alternates: { canonical: "/napojovy-listek" },
};

export default async function Page() {
  const categories = await getCatalog("drink");
  return (
    <>
      <PageHero eyebrow="Z výčepu i baru" title="Nápojový lístek" />
      <section className="py-12 sm:py-16">
        <div className="container-page">
          <CatalogList categories={categories} emptyText="Nápojový lístek připravujeme" />
          <p className="mt-12 text-sm text-ink-soft">
            Ceny jsou uvedeny v Kč včetně DPH. Informace o alergenech vám rádi sdělí obsluha.
          </p>
        </div>
      </section>
    </>
  );
}
