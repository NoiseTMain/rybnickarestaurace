import { publicEnv } from "@/lib/env";
import { publicFileUrl } from "@/lib/storage";
import type { SiteSettings } from "@/lib/types";
import { logoUrl } from "./Logo";

const SCHEMA_DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Strukturovaná data schema.org/Restaurant – jen skutečně vyplněné údaje. */
export function RestaurantJsonLd({ settings }: { settings: SiteSettings }) {
  const site = publicEnv.siteUrl;
  const logo = logoUrl(settings);
  const absolute = (u: string | null) => (u ? (u.startsWith("http") ? u : `${site}${u}`) : undefined);
  const hero = publicFileUrl("media", settings.hero_image_path);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${site}/#restaurace`,
    name: settings.restaurant_name,
    url: site,
    telephone: settings.phone,
    email: settings.email,
    servesCuisine: ["Česká kuchyně"],
    acceptsReservations: true,
    hasMenu: `${site}/jidelni-listek`,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address_street,
      postalCode: settings.address_zip,
      addressLocality: settings.address_city,
      addressCountry: "CZ",
    },
    logo: absolute(logo),
    image: [absolute(hero), absolute(logo)].filter(Boolean),
    amenityFeature: settings.services
      .filter((s) => s.enabled)
      .map((s) => ({ "@type": "LocationFeatureSpecification", name: s.label, value: true })),
    sameAs: [settings.facebook_url, settings.instagram_url].filter(Boolean),
  };
  if (settings.latitude !== null && settings.longitude !== null) {
    data.geo = { "@type": "GeoCoordinates", latitude: settings.latitude, longitude: settings.longitude };
  }
  const spec = settings.opening_hours
    .filter((d) => !d.closed)
    .flatMap((d) => d.intervals.map((i) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: SCHEMA_DAYS[d.day], opens: i.open, closes: i.close })));
  if (spec.length) data.openingHoursSpecification = spec;

  return (
    <script
      type="application/ld+json"
      // JSON neobsahuje uživatelské HTML; „<“ se escapuje kvůli bezpečnosti
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
