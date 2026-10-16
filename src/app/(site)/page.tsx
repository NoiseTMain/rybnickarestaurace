import Image from "next/image";
import Link from "next/link";
import { CatalogList } from "@/components/site/Catalog";
import { CatalogTabs } from "@/components/site/CatalogTabs";
import { ContactDetails } from "@/components/site/Contact";
import { DailyMenuBlock } from "@/components/site/DailyMenu";
import { Gallery, type GalleryItem } from "@/components/site/Gallery";
import { Logo, logoUrl } from "@/components/site/Logo";
import { formatIntervals } from "@/components/site/OpeningHours";
import { Ripples, SectionHeading } from "@/components/site/Section";
import { ServicesList } from "@/components/site/Services";
import { SpacesGrid } from "@/components/site/Spaces";
import { SportList } from "@/components/site/Sports";
import { ArrowRightIcon, BeerIcon, ClockIcon, MenuBookIcon, PhoneIcon, PinIcon } from "@/components/ui/icons";
import { getCatalog, getCurrentMenu, getGallery, getSiteSettings, getSpaces, getUpcomingSports } from "@/lib/data/public";
import { fullAddress, mapLinks, telHref } from "@/lib/format";
import { publicFileUrl } from "@/lib/storage";
import { pragueWeekday } from "@/lib/time";
import { GALLERY_CATEGORIES } from "@/lib/types";

export const revalidate = 300;

export default async function HomePage() {
  const [settings, menu, food, drinks, spaces, gallery, sports] = await Promise.all([
    getSiteSettings(),
    getCurrentMenu(),
    getCatalog("food"),
    getCatalog("drink"),
    getSpaces(),
    getGallery(),
    getUpcomingSports(),
  ]);
  const t = settings.texts;
  const tel = telHref(settings.phone);
  const hero = publicFileUrl("media", settings.hero_image_path);
  const logo = logoUrl(settings);
  const today = settings.opening_hours.find((d) => d.day === pragueWeekday());
  const aboutPhoto = gallery.find((p) => p.category === "restaurace") ?? gallery[0];
  const galleryItems: GalleryItem[] = gallery.slice(0, 8).map((p) => ({
    id: p.id,
    url: publicFileUrl("media", p.storage_path)!,
    alt: p.alt,
    category: p.category,
    spaceSlug: spaces.find((s) => s.id === p.space_id)?.slug ?? null,
    width: p.width,
    height: p.height,
  }));

  return (
    <>
      {/* ÚVOD */}
      <section className="relative isolate overflow-hidden bg-pond-950 text-paper">
        {hero ? (
          <>
            <Image src={hero} alt="" fill priority sizes="100vw" className="-z-20 object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-pond-950 via-pond-950/70 to-pond-950/30 sm:bg-gradient-to-r sm:from-pond-950/95 sm:via-pond-950/65 sm:to-pond-950/10" />
          </>
        ) : (
          <div className="ripple-bg absolute inset-0 -z-10">
            <Ripples className="!-right-10 !top-10 !h-[44rem] !w-[44rem] sm:!-right-32" />
          </div>
        )}
        <div className="container-page flex flex-col justify-center pt-12 pb-14 sm:min-h-[36rem] sm:py-24 lg:min-h-[40rem]">
          <div className="max-w-3xl animate-rise">
            {logo && (
              <div className="mb-8 inline-flex rounded-2xl bg-paper/95 px-4 py-3 text-pond-900 shadow-lg">
                <Logo url={logo} name={settings.restaurant_name} className="h-14 sm:h-16" />
              </div>
            )}
            <p className="eyebrow !text-amber-300">{t.hero_eyebrow ?? "Rybníky u Dobříše"}</p>
            <h1 className="mt-4 font-display text-[2.9rem] leading-[0.98] font-semibold text-balance sm:text-7xl">
              {t.hero_title ?? settings.restaurant_name}
            </h1>
            {t.hero_subtitle && <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-paper/80 sm:mt-6 sm:text-xl">{t.hero_subtitle}</p>}
            <div className="mt-9 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <Link href="#menu" className="btn btn-primary col-span-2 !min-h-14 !text-base sm:col-span-1">
                <MenuBookIcon size={20} /> DNEŠNÍ MENU
              </Link>
              <Link href="/napojovy-listek" className="btn btn-ghost-light !px-3 text-[0.82rem] sm:!px-6 sm:text-[0.95rem]">
                <BeerIcon size={19} className="hidden sm:block" /> NÁPOJOVÝ LÍSTEK
              </Link>
              <Link href="/rezervace" className="btn btn-ghost-light !px-3 text-[0.82rem] sm:!px-6 sm:text-[0.95rem]">
                REZERVOVAT
              </Link>
              <a href={tel} className="btn btn-ghost-light col-span-2 sm:col-span-1">
                <PhoneIcon size={18} /> ZAVOLAT
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* RYCHLÉ INFO */}
      <div className="border-b border-line bg-white">
        <div className="container-page grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <a href={tel} className="flex items-center gap-3 py-4 sm:px-6 sm:first:pl-0">
            <PhoneIcon className="shrink-0 text-amber-600" />
            <span>
              <span className="block text-xs text-ink-soft">Telefon</span>
              <span className="font-semibold">{settings.phone}</span>
            </span>
          </a>
          <div className="flex items-center gap-3 py-4 sm:px-6">
            <ClockIcon className="shrink-0 text-amber-600" />
            <span>
              <span className="block text-xs text-ink-soft">Dnes</span>
              <span className="font-semibold">{settings.opening_hours.length ? formatIntervals(today) : "Otevírací dobu sdělíme telefonicky"}</span>
            </span>
          </div>
          <a href={mapLinks(settings).directions} target="_blank" rel="noopener" className="flex items-center gap-3 py-4 sm:px-6">
            <PinIcon className="shrink-0 text-amber-600" />
            <span>
              <span className="block text-xs text-ink-soft">Adresa · navigovat</span>
              <span className="font-semibold">{fullAddress(settings)}</span>
            </span>
          </a>
        </div>
      </div>

      {/* DNEŠNÍ MENU */}
      <section id="menu" aria-labelledby="menu-title" className="bg-paper py-16 sm:py-24">
        <div className="container-page">
          <div className="mb-10 flex flex-col items-center text-center">
            <p className="eyebrow">Polední nabídka</p>
            <h2 id="menu-title" className="mt-3 font-display text-4xl font-semibold tracking-wide text-pond-950 sm:text-6xl">
              DNEŠNÍ MENU
            </h2>
            {t.menu_note && <p className="mt-4 max-w-xl text-ink-soft">{t.menu_note}</p>}
          </div>
          <DailyMenuBlock menu={menu} />
        </div>
      </section>

      {/* O NÁS */}
      <section aria-labelledby="about-title" className="border-y border-line bg-cream/60 py-16 sm:py-24">
        <div className={`container-page grid items-center gap-12 ${aboutPhoto ? "lg:grid-cols-2" : ""}`}>
          <div>
            <SectionHeading id="about-title" eyebrow="O restauraci" title={t.about_title ?? "Vítejte v Rybníkách"} intro={t.about_text} />
            <div className="mt-8">
              <ServicesList services={settings.services} />
            </div>
          </div>
          {aboutPhoto && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-[var(--shadow-lift)]">
              <Image
                src={publicFileUrl("media", aboutPhoto.storage_path)!}
                alt={aboutPhoto.alt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          )}
        </div>
      </section>

      {/* LÍSTEK */}
      <section aria-labelledby="listek-title" className="py-16 sm:py-24">
        <div className="container-page">
          <SectionHeading id="listek-title" eyebrow="Stálá nabídka" title="Jídla a nápoje" intro="Chuťovky k pivu, česká klasika a dobře natočené pivo." />
          <div className="mt-10">
            <CatalogTabs
              food={<CatalogList categories={food} emptyText="Jídelní lístek připravujeme" />}
              drinks={<CatalogList categories={drinks} emptyText="Nápojový lístek připravujeme" />}
            />
          </div>
        </div>
      </section>

      {/* PROSTORY */}
      {spaces.length > 0 && (
        <section aria-labelledby="prostory-title" className="border-t border-line bg-cream/60 py-16 sm:py-24">
          <div className="container-page">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <SectionHeading id="prostory-title" eyebrow="Prostory a akce" title="Místo pro každou příležitost" intro={t.spaces_intro} />
              <Link href="/rezervace?typ=akce" className="btn btn-dark shrink-0">
                Poptat pronájem nebo oslavu
              </Link>
            </div>
            <div className="mt-10">
              <SpacesGrid spaces={spaces} photos={gallery} />
            </div>
          </div>
        </section>
      )}

      {/* SPORT */}
      <section aria-labelledby="sport-title" className="ripple-bg relative overflow-hidden py-16 text-paper sm:py-24">
        <Ripples />
        <div className="container-page relative grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <SectionHeading id="sport-title" eyebrow="Sportovní přenosy" title="Fandíme spolu" intro={t.sport_intro} tone="dark" />
            <Link href="/sportovni-prenosy" className="mt-8 inline-flex items-center gap-2 font-semibold text-amber-300 hover:text-amber-400">
              Celý program přenosů <ArrowRightIcon size={18} />
            </Link>
          </div>
          <SportList events={sports} limit={4} />
        </div>
      </section>

      {/* GALERIE */}
      {galleryItems.length > 0 && (
        <section aria-labelledby="galerie-title" className="py-16 sm:py-24">
          <div className="container-page">
            <div className="mb-10 flex items-end justify-between gap-6">
              <SectionHeading id="galerie-title" eyebrow="Fotogalerie" title="Nahlédněte k nám" />
              <Link href="/galerie" className="hidden shrink-0 items-center gap-2 font-semibold text-pond-700 hover:text-pond-900 sm:inline-flex">
                Celá galerie <ArrowRightIcon size={18} />
              </Link>
            </div>
            <Gallery items={galleryItems} categories={[...GALLERY_CATEGORIES]} showFilters={false} />
            <Link href="/galerie" className="btn btn-outline mt-8 w-full sm:hidden">
              Celá galerie
            </Link>
          </div>
        </section>
      )}

      {/* KONTAKT */}
      <section aria-labelledby="kontakt-title" className="border-t border-line bg-cream/60 py-16 sm:py-24">
        <div className="container-page">
          <SectionHeading id="kontakt-title" eyebrow="Kontakt" title="Kde nás najdete" />
          <div className="mt-10">
            <ContactDetails settings={settings} />
          </div>
        </div>
      </section>
    </>
  );
}
