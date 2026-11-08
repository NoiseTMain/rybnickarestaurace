import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HomeOS – rodinné finance",
    short_name: "HomeOS",
    description: "Osobní a rodinná finanční centrála",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    lang: "cs",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Rychlý zápis výdaje", short_name: "Zapsat", description: "Napište nebo nadiktujte „oběd 180 Kč“", url: "/asistent", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Příjmy a výdaje", short_name: "Pohyby", url: "/transakce", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Pravidelné platby", short_name: "Platby", url: "/platby", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Hlídané termíny", short_name: "Termíny", url: "/majetek#terminy", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
    categories: ["finance", "productivity"],
  };
}
