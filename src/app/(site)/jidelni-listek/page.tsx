import type { Metadata } from "next";
import { CatalogList } from "@/components/site/Catalog";
import { PageHero } from "@/components/site/Section";
import { getCatalog } from "@/lib/data/public";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Jídelní lístek",
  description: "Stálá nabídka jídel Restaurace Rybníky – česká kuchyně a chuťovky k pivu.",
  alternates: { canonical: "/jidelni-listek" },
};

export default async function Page() {
  const categories = await getCatalog("food");
  return (
    <>
      <PageHero eyebrow="Stálá nabídka" title="Jídelní lístek" />
      <section className="py-12 sm:py-16">
        <div className="container-page">
          <CatalogList categories={categories} emptyText="Jídelní lístek připravujeme" />
          <p className="mt-12 text-sm text-ink-soft">
            Ceny jsou uvedeny v Kč včetně DPH. Informace o alergenech vám rádi sdělí obsluha.
          </p>
        </div>
      </section>
    </>
  );
}
