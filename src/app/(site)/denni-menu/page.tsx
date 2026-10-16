import type { Metadata } from "next";
import { DailyMenuBlock } from "@/components/site/DailyMenu";
import { PageHero } from "@/components/site/Section";
import { PhoneIcon } from "@/components/ui/icons";
import { getCurrentMenu, getSiteSettings } from "@/lib/data/public";
import { telHref } from "@/lib/format";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Denní menu",
  description: "Aktuální denní menu Restaurace Rybníky u Dobříše. Polední nabídka zveřejňovaná každý den, jídlo s sebou po telefonické domluvě.",
  alternates: { canonical: "/denni-menu" },
};

export default async function DailyMenuPage() {
  const [settings, menu] = await Promise.all([getSiteSettings(), getCurrentMenu()]);
  return (
    <>
      <PageHero eyebrow="Polední nabídka" title="Dnešní menu" intro={settings.texts.menu_note} />
      <section className="py-12 sm:py-16">
        <div className="container-page">
          <DailyMenuBlock menu={menu} />
          <p className="mx-auto mt-10 max-w-xl text-center text-ink-soft">
            Jídlo s sebou si můžete objednat telefonicky na{" "}
            <a href={telHref(settings.phone)} className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-pond-700">
              <PhoneIcon size={16} /> {settings.phone}
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
