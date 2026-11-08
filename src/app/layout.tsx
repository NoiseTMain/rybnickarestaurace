import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { I18nProvider } from "@/components/I18n";
import { getLocale } from "@/lib/i18n/server";
import { BACKGROUNDS, THEME_COOKIE, parseTheme, rootFontSize, sceneUrl, themeVars } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: "HomeOS", template: "%s · HomeOS" },
  description: "Osobní a rodinná finanční centrála",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "HomeOS", statusBarStyle: "black-translucent" },
};

export async function generateViewport(): Promise<Viewport> {
  const { bg } = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return { themeColor: BACKGROUNDS[bg].base, width: "device-width", initialScale: 1, viewportFit: "cover" };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const scene = sceneUrl(theme);
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      data-accent={theme.accent}
      data-bg={theme.bg}
      data-privacy={theme.privacy ? "1" : "0"}
      data-motion={theme.motion ? "on" : "off"}
      style={{ ...(themeVars(theme) as React.CSSProperties), fontSize: rootFontSize(theme) }}
    >
      <body>
        <div className="ambient" aria-hidden />
        <div id="ambient-scene" className="ambient-scene" aria-hidden style={scene ? { backgroundImage: `url("${scene}")` } : { display: "none" }} />
        <I18nProvider locale={locale}><ToastProvider>{children}</ToastProvider></I18nProvider>
      </body>
    </html>
  );
}
