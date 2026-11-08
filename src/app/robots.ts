import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "https://rybnickarestaurace-inky.vercel.app";
  return { rules: [{ userAgent: "*", allow: ["/vitejte", "/kalkulacky", "/clanky", "/podminky", "/soukromi"], disallow: ["/api/", "/sdilene/", "/admin"] }], sitemap: `${base}/sitemap.xml` };
}
