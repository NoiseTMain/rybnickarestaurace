import type { Metadata } from "next";
import { Ripples } from "@/components/site/Section";
import { SportList } from "@/components/site/Sports";
import { getSiteSettings, getUpcomingSports } from "@/lib/data/public";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Sportovní přenosy",
  description: "Program sportovních přenosů v Restauraci Rybníky u Dobříše – fotbal, hokej a další sporty u točeného piva.",
  alternates: { canonical: "/sportovni-prenosy" },
};

export default async function SportsPage() {
  const [settings, events] = await Promise.all([getSiteSettings(), getUpcomingSports()]);
  return (
    <section className="ripple-bg relative min-h-[70vh] overflow-hidden py-14 text-paper sm:py-20">
      <Ripples />
      <div className="container-page relative">
        <p className="eyebrow !text-amber-300">Program</p>
        <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Sportovní přenosy</h1>
        {settings.texts.sport_intro && <p className="mt-4 max-w-2xl text-lg text-paper/75">{settings.texts.sport_intro}</p>}
        <div className="mt-10 max-w-3xl">
          <SportList events={events} />
        </div>
      </div>
    </section>
  );
}
