import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { RestaurantJsonLd } from "@/components/site/JsonLd";
import { logoUrl } from "@/components/site/Logo";
import { MobileActionBar } from "@/components/site/MobileActionBar";
import { getSiteSettings } from "@/lib/data/public";
import { mapLinks, telHref } from "@/lib/format";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  const logo = logoUrl(settings);
  const tel = telHref(settings.phone);
  return (
    <>
      <a href="#obsah" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Přeskočit na obsah
      </a>
      <Header logo={logo} name={settings.restaurant_name} phone={settings.phone} tel={tel} />
      <main id="obsah">{children}</main>
      <Footer settings={settings} logo={logo} />
      <MobileActionBar tel={tel} directions={mapLinks(settings).directions} />
      <RestaurantJsonLd settings={settings} />
    </>
  );
}
