import type { Metadata } from "next";
import { InquiryForm } from "@/components/site/InquiryForm";
import { PageHero } from "@/components/site/Section";
import { getSiteSettings, getSpaces } from "@/lib/data/public";
import { telHref } from "@/lib/format";

export const metadata: Metadata = {
  title: "Rezervace a poptávka akce",
  description: "Rezervujte si stůl nebo poptejte pronájem sálu či salonku v Restauraci Rybníky u Dobříše.",
  alternates: { canonical: "/rezervace" },
};

export default async function ReservationPage({ searchParams }: { searchParams: Promise<{ typ?: string }> }) {
  const [{ typ }, settings, spaces] = await Promise.all([searchParams, getSiteSettings(), getSpaces()]);
  const tel = telHref(settings.phone);
  return (
    <>
      <PageHero
        eyebrow="Rezervace"
        title="Rezervace a poptávky"
        intro={
          <>
            Nejrychleji to vyřídíme telefonicky na{" "}
            <a href={tel} className="font-semibold whitespace-nowrap text-amber-300 underline underline-offset-4">
              {settings.phone}
            </a>
            . Můžete nám také poslat zprávu – ozveme se vám zpět.
          </>
        }
      />
      <section className="py-12 sm:py-16">
        <div className="container-page max-w-3xl">
          <InquiryForm defaultKind={typ === "akce" ? "event" : "reservation"} spaces={spaces.map((s) => s.name)} phone={settings.phone} tel={tel} />
        </div>
      </section>
    </>
  );
}
