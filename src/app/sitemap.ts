import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export const revalidate = 3600;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicEnv.siteUrl;
  const pages: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["", 1, "daily"],
    ["/denni-menu", 0.9, "daily"],
    ["/jidelni-listek", 0.8, "weekly"],
    ["/napojovy-listek", 0.7, "weekly"],
    ["/prostory", 0.8, "monthly"],
    ["/sportovni-prenosy", 0.6, "weekly"],
    ["/galerie", 0.5, "monthly"],
    ["/kontakt", 0.8, "monthly"],
    ["/rezervace", 0.6, "monthly"],
  ];
  return pages.map(([path, priority, changeFrequency]) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
