import type { MetadataRoute } from "next";
import { ARTICLES } from "@/lib/articles";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "https://rybnickarestaurace-inky.vercel.app";
  return [
    { url: `${base}/vitejte`, priority: 1 },
    { url: `${base}/kalkulacky`, priority: 0.9 },
    { url: `${base}/clanky`, priority: 0.8 },
    ...ARTICLES.map((a) => ({ url: `${base}/clanky/${a.slug}`, priority: 0.7 })),
    { url: `${base}/podminky`, priority: 0.2 },
    { url: `${base}/soukromi`, priority: 0.2 },
  ];
}
