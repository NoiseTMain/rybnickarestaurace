import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { BACKGROUNDS, THEME_COOKIE, parseTheme, themeVars } from "@/lib/theme";

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
  const { accent, bg } = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="cs" data-accent={accent} data-bg={bg} style={themeVars(accent, bg) as React.CSSProperties}>
      <body>
        <div className="ambient" aria-hidden />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
