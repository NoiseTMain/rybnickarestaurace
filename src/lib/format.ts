import type { SiteSettings } from "@/lib/types";

const priceFormatter = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** 145 → „145 Kč“, 39.5 → „39,50 Kč“ */
export function formatPrice(price: number | string | null | undefined): string | null {
  if (price === null || price === undefined || price === "") return null;
  const n = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(n)) return null;
  const s = Number.isInteger(n) ? priceFormatter.format(n) : n.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${s} Kč`;
}

/** „+420 602 163 330“ → „tel:+420602163330“ */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

export function fullAddress(s: Pick<SiteSettings, "address_street" | "address_zip" | "address_city">): string {
  return `${s.address_street}, ${s.address_zip} ${s.address_city}`;
}

/** Odkazy na mapu a navigaci (Google Maps funguje na iOS i Androidu). */
export function mapLinks(s: Pick<SiteSettings, "address_street" | "address_zip" | "address_city" | "latitude" | "longitude" | "restaurant_name">) {
  const destination =
    s.latitude !== null && s.longitude !== null ? `${s.latitude},${s.longitude}` : `${s.restaurant_name}, ${fullAddress(s)}`;
  const q = encodeURIComponent(destination);
  return {
    directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    search: `https://www.google.com/maps/search/?api=1&query=${q}`,
    embed: `https://www.google.com/maps?q=${q}&z=15&output=embed`,
  };
}
