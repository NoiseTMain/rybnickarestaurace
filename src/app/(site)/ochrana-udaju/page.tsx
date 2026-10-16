import type { Metadata } from "next";
import { PageHero } from "@/components/site/Section";
import { getSiteSettings } from "@/lib/data/public";
import { fullAddress } from "@/lib/format";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Ochrana osobních údajů",
  alternates: { canonical: "/ochrana-udaju" },
};

export default async function PrivacyPage() {
  const s = await getSiteSettings();
  return (
    <>
      <PageHero eyebrow="Informace" title="Ochrana osobních údajů" />
      <section className="py-12 sm:py-16">
        <div className="container-page max-w-3xl space-y-5 leading-relaxed text-ink-soft">
          <p>
            Správcem osobních údajů je provozovatel podniku {s.restaurant_name}, {fullAddress(s)}, kontakt:{" "}
            <a className="text-pond-700 underline" href={`mailto:${s.email}`}>{s.email}</a>, {s.phone}.
          </p>
          <p>
            Údaje z formuláře rezervace a poptávky (jméno, telefon, e-mail, termín, počet osob a zpráva) zpracováváme
            pouze za účelem vyřízení vašeho požadavku a uchováváme je jen po dobu nezbytně nutnou.
          </p>
          <p>
            Web nepoužívá reklamní ani analytické cookies. Mapa Google se načte až po kliknutí na tlačítko „Zobrazit mapu“;
            poté může Google používat vlastní cookies.
          </p>
          <p>Máte právo na přístup ke svým údajům, jejich opravu nebo výmaz. Stačí nám napsat nebo zavolat.</p>
        </div>
      </section>
    </>
  );
}
