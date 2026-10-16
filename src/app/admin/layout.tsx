import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Administrace", template: "%s | Administrace Rybníky" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f4f1ea]">{children}</div>;
}
