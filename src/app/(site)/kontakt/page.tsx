import type { Metadata } from "next";
import { ContactDetails } from "@/components/site/Contact";
import { PageHero } from "@/components/site/Section";
import { getSiteSettings } from "@/lib/data/public";
import { fullAddress } from "@/lib/format";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  return {
    title: "Kontakt a otevírací doba",
    description: `${s.restaurant_name}, ${fullAddress(s)}. Telefon ${s.phone}, e-mail ${s.email}. Otevírací doba, mapa a navigace.`,
    alternates: { canonical: "/kontakt" },
  };
}

export default async function ContactPage() {
  const settings = await getSiteSettings();
  return (
    <>
      <PageHero eyebrow="Kontakt" title="Kde nás najdete" intro={fullAddress(settings)} />
      <section className="py-12 sm:py-16">
        <div className="container-page">
          <ContactDetails settings={settings} />
        </div>
      </section>
    </>
  );
}
