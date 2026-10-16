import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./globals.css";
import { logoUrl } from "@/components/site/Logo";
import { getSiteSettings } from "@/lib/data/public";
import { publicEnv } from "@/lib/env";
import { publicFileUrl } from "@/lib/storage";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const logo = logoUrl(settings);
  const hero = publicFileUrl("media", settings.hero_image_path);
  const description =
    "Restaurace Rybníky u Dobříše – denní menu, jídelní a nápojový lístek, chuťovky k pivu, sportovní přenosy, salonky, sál pro oslavy a venkovní zahrádka.";
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: {
      default: "Restaurace Rybníky – denní menu a hospoda u Dobříše",
      template: "%s | Restaurace Rybníky",
    },
    description,
    applicationName: settings.restaurant_name,
    keywords: [
      "Restaurace Rybníky",
      "restaurace Rybníky Dobříš",
      "denní menu Rybníky",
      "restaurace v okolí Dobříše",
      "pronájem sálu Rybníky",
      "hospoda Dobříš",
    ],
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "cs_CZ",
      siteName: settings.restaurant_name,
      title: "Restaurace Rybníky – denní menu a hospoda u Dobříše",
      description,
      url: "/",
      images: [{ url: hero ?? "/og-image.png", width: 1200, height: 630, alt: settings.restaurant_name }],
    },
    twitter: { card: "summary_large_image" },
    icons: logo ? { icon: logo, apple: logo } : undefined,
    formatDetection: { telephone: true, address: true, email: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#14302a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
