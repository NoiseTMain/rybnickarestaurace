import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/server";
import type {
  CategoryWithItems,
  DailyMenu,
  GalleryPhoto,
  MenuKind,
  SiteSettings,
  Space,
  SportEvent,
} from "@/lib/types";

/** Ověřené údaje – použijí se, jen pokud databáze není dostupná. */
export const FALLBACK_SETTINGS: SiteSettings = {
  restaurant_name: "Restaurace Rybníky",
  phone: "+420 602 163 330",
  email: "info@rybnickarestaurace.cz",
  address_street: "Rybníky 40",
  address_zip: "263 01",
  address_city: "Dobříš",
  latitude: null,
  longitude: null,
  opening_hours: [],
  opening_hours_note: null,
  services: [],
  texts: {},
  logo_path: null,
  hero_image_path: null,
  facebook_url: null,
  instagram_url: null,
};

function logError(scope: string, error: unknown) {
  console.error(`[data:${scope}]`, error);
}

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  if (!isSupabaseConfigured()) return FALLBACK_SETTINGS;
  const { data, error } = await createPublicClient().from("site_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) {
    if (error) logError("settings", error);
    return FALLBACK_SETTINGS;
  }
  return { ...FALLBACK_SETTINGS, ...(data as SiteSettings) };
});

/** Aktuálně zveřejněné menu (null = zatím žádné). */
export const getCurrentMenu = cache(async (): Promise<DailyMenu | null> => {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await createPublicClient()
    .from("daily_menus")
    .select("*")
    .eq("is_current", true)
    .maybeSingle();
  if (error) logError("menu", error);
  return (data as DailyMenu | null) ?? null;
});

export const getCatalog = cache(async (kind: MenuKind): Promise<CategoryWithItems[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createPublicClient()
    .from("menu_categories")
    .select("*, items:menu_items(*)")
    .eq("kind", kind)
    .eq("is_visible", true)
    .order("sort_order")
    .order("sort_order", { referencedTable: "menu_items" });
  if (error) {
    logError("catalog", error);
    return [];
  }
  return ((data ?? []) as CategoryWithItems[])
    .map((c) => ({ ...c, items: c.items.filter((i) => i.is_visible) }))
    .filter((c) => c.items.length > 0);
});

export const getSpaces = cache(async (): Promise<Space[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createPublicClient()
    .from("spaces")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order");
  if (error) logError("spaces", error);
  return (data as Space[] | null) ?? [];
});

export const getGallery = cache(async (): Promise<GalleryPhoto[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createPublicClient()
    .from("gallery_photos")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) logError("gallery", error);
  return (data as GalleryPhoto[] | null) ?? [];
});

/** Nadcházející přenosy (a ty, které začaly před méně než 3 hodinami). */
export const getUpcomingSports = cache(async (): Promise<SportEvent[]> => {
  if (!isSupabaseConfigured()) return [];
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data, error } = await createPublicClient()
    .from("sport_events")
    .select("*")
    .eq("is_visible", true)
    .gte("starts_at", since)
    .order("starts_at")
    .limit(50);
  if (error) logError("sports", error);
  return (data as SportEvent[] | null) ?? [];
});
