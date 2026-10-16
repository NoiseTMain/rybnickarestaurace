"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { revalidatePublicSite } from "@/lib/menus";
import { createSessionClient } from "@/lib/supabase/server";
import { pragueLocalToUtcIso } from "@/lib/time";
import { GALLERY_CATEGORIES, TEXT_FIELDS, type OpeningDay, type Service } from "@/lib/types";

// ---------------------------------------------------------------------
// Pomocné funkce
// ---------------------------------------------------------------------
const ok = (message: string): ActionState => ({ ok: true, message });
const fail = (message: string): ActionState => ({ ok: false, message });

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function optStr(fd: FormData, key: string): string | null {
  return str(fd, key) || null;
}
function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on" || fd.get(key) === "true";
}
function done(adminPath: string) {
  revalidatePublicSite();
  revalidatePath(adminPath);
}

const uuid = z.uuid();
const email = z.string().trim().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Neplatná e-mailová adresa.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Čas zadejte ve formátu HH:MM.");
const price = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s|Kč/gi, "").replace(",", "."))
  .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) < 1_000_000), "Cena musí být číslo, např. 145 nebo 39,50.")
  .transform((v) => (v === "" ? null : Number(v)));
const httpUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Odkaz musí začínat https://")
  .transform((v) => v || null);

// Cesty v bucketu „media“, které smí administrace přiřadit
const MEDIA_PATH = /^(gallery|hero|logo|spaces)\/[0-9a-f-]{36}\.(jpe?g|png|webp|avif|svg)$/;

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/admin/prihlaseni");
}

// ---------------------------------------------------------------------
// Nastavení – kontakt, otevírací doba, texty, služby, e-mail
// ---------------------------------------------------------------------
export async function saveContact(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const schema = z.object({
    restaurant_name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(5).max(40).regex(/^[+0-9 ()/-]+$/, "Telefon obsahuje neplatné znaky."),
    email,
    address_street: z.string().trim().min(2).max(120),
    address_zip: z.string().trim().min(3).max(12),
    address_city: z.string().trim().min(2).max(80),
    latitude: z.string().trim().transform((v) => (v ? Number(v.replace(",", ".")) : null)).refine((v) => v === null || (v >= -90 && v <= 90), "Neplatná zeměpisná šířka."),
    longitude: z.string().trim().transform((v) => (v ? Number(v.replace(",", ".")) : null)).refine((v) => v === null || (v >= -180 && v <= 180), "Neplatná zeměpisná délka."),
    facebook_url: httpUrl,
    instagram_url: httpUrl,
  });
  const parsed = schema.safeParse(Object.fromEntries(["restaurant_name", "phone", "email", "address_street", "address_zip", "address_city", "latitude", "longitude", "facebook_url", "instagram_url"].map((k) => [k, str(fd, k)])));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Zkontrolujte vyplněné údaje.");
  const { error } = await supabase.from("site_settings").update(parsed.data).eq("id", 1);
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  done("/admin/nastaveni");
  return ok("Kontaktní údaje jsou uložené.");
}

export async function saveOpeningHours(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const hours: OpeningDay[] = [];
  for (let day = 1; day <= 7; day++) {
    const closed = bool(fd, `closed_${day}`);
    const intervals: OpeningDay["intervals"] = [];
    for (const n of [1, 2]) {
      const open = str(fd, `open_${day}_${n}`);
      const close = str(fd, `close_${day}_${n}`);
      if (!open && !close) continue;
      if (!time.safeParse(open).success || !time.safeParse(close).success) {
        return fail(`Den ${day}: vyplňte čas otevření i zavření ve formátu HH:MM.`);
      }
      intervals.push({ open, close });
    }
    if (!closed && intervals.length === 0) return fail(`Den ${day}: vyplňte čas, nebo označte „Zavřeno“.`);
    hours.push({ day, closed, intervals: closed ? [] : intervals });
  }
  const clear = bool(fd, "clear");
  const { error } = await supabase
    .from("site_settings")
    .update({ opening_hours: clear ? [] : hours, opening_hours_note: optStr(fd, "opening_hours_note") })
    .eq("id", 1);
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  done("/admin/nastaveni");
  return ok(clear ? "Otevírací doba byla skryta." : "Otevírací doba je uložená.");
}

export async function saveTexts(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const texts: Record<string, string> = {};
  for (const f of TEXT_FIELDS) {
    const v = str(fd, f.key);
    if (v.length > 2000) return fail(`Text „${f.label}“ je příliš dlouhý.`);
    if (v) texts[f.key] = v;
  }
  const { error } = await supabase.from("site_settings").update({ texts }).eq("id", 1);
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  done("/admin/nastaveni");
  return ok("Texty webu jsou uložené.");
}

export async function saveServices(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const services: Service[] = [];
  const keys = fd.getAll("service_key").map(String);
  for (const key of keys) {
    if (!/^[a-z0-9_-]{1,40}$/.test(key)) continue;
    const label = str(fd, `service_label_${key}`).slice(0, 80);
    if (!label) continue;
    services.push({ key, label, enabled: bool(fd, `service_enabled_${key}`) });
  }
  const newLabel = str(fd, "new_service").slice(0, 80);
  if (newLabel) services.push({ key: `custom-${Date.now().toString(36)}`, label: newLabel, enabled: true });
  const { error } = await supabase.from("site_settings").update({ services }).eq("id", 1);
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  done("/admin/nastaveni");
  return ok("Služby jsou uložené.");
}

export async function saveEmailSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const menuRecipient = email.safeParse(str(fd, "menu_email_recipient"));
  const inquiryRecipient = email.safeParse(str(fd, "inquiry_email_recipient"));
  if (!menuRecipient.success || !inquiryRecipient.success) return fail("Zadejte platné e-mailové adresy.");
  const { error } = await supabase
    .from("private_settings")
    .update({
      menu_email_recipient: menuRecipient.data,
      inquiry_email_recipient: inquiryRecipient.data,
      menu_email_enabled: bool(fd, "menu_email_enabled"),
    })
    .eq("id", 1);
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  revalidatePath("/admin", "layout");
  return ok("Nastavení e-mailu je uložené.");
}

/** Po nahrání loga / úvodní fotky z prohlížeče uloží cestu do nastavení. */
export async function setBrandImage(kind: "logo" | "hero", path: string | null): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  if (path !== null && (!MEDIA_PATH.test(path) || !path.startsWith(`${kind}/`))) return fail("Neplatný soubor.");
  const column = kind === "logo" ? "logo_path" : "hero_image_path";
  const { data: before } = await supabase.from("site_settings").select(column).eq("id", 1).single();
  const { error } = await supabase.from("site_settings").update({ [column]: path }).eq("id", 1);
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  const old = (before as Record<string, string | null> | null)?.[column];
  if (old && old !== path && MEDIA_PATH.test(old)) await supabase.storage.from("media").remove([old]);
  revalidatePath("/", "layout");
  return ok(kind === "logo" ? (path ? "Logo je uložené." : "Logo bylo odebráno.") : path ? "Úvodní fotografie je uložená." : "Úvodní fotografie byla odebrána.");
}

// ---------------------------------------------------------------------
// Jídelní a nápojový lístek
// ---------------------------------------------------------------------
export async function createCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const kind = str(fd, "kind");
  const name = str(fd, "name");
  if (kind !== "food" && kind !== "drink") return fail("Neplatný typ.");
  if (!name || name.length > 120) return fail("Vyplňte název kategorie.");
  const { data: last } = await supabase.from("menu_categories").select("sort_order").eq("kind", kind).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("menu_categories").insert({ kind, name, sort_order: (last?.sort_order ?? 0) + 10 });
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  done("/admin/nabidka");
  return ok(`Kategorie „${name}“ byla přidána.`);
}

export async function updateCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  const name = str(fd, "name");
  if (!id.success || !name) return fail("Vyplňte název kategorie.");
  const { error } = await supabase
    .from("menu_categories")
    .update({ name, description: optStr(fd, "description"), sort_order: Number(str(fd, "sort_order")) || 0, is_visible: bool(fd, "is_visible") })
    .eq("id", id.data);
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  done("/admin/nabidka");
  return ok("Kategorie je uložená.");
}

export async function deleteCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) return fail("Neplatná kategorie.");
  const { error } = await supabase.from("menu_categories").delete().eq("id", id.data);
  if (error) return fail(`Smazání selhalo: ${error.message}`);
  done("/admin/nabidka");
  return ok("Kategorie byla smazána.");
}

const itemSchema = z.object({
  category_id: uuid,
  name: z.string().trim().min(1, "Vyplňte název položky.").max(200),
  description: z.string().trim().max(500).transform((v) => v || null),
  portion: z.string().trim().max(40).transform((v) => v || null),
  price,
  price_note: z.string().trim().max(80).transform((v) => v || null),
  allergens: z.string().trim().max(60).transform((v) => v || null),
  sort_order: z.coerce.number().int().min(0).max(100000).catch(0),
});

function readItem(fd: FormData) {
  return itemSchema.safeParse(Object.fromEntries(["category_id", "name", "description", "portion", "price", "price_note", "allergens", "sort_order"].map((k) => [k, str(fd, k)])));
}

export async function saveItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = readItem(fd);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Zkontrolujte položku.");
  const idRaw = str(fd, "id");
  const row = { ...parsed.data, is_visible: idRaw ? bool(fd, "is_visible") : true };
  if (idRaw) {
    const id = uuid.safeParse(idRaw);
    if (!id.success) return fail("Neplatná položka.");
    const { error } = await supabase.from("menu_items").update(row).eq("id", id.data);
    if (error) return fail(`Uložení selhalo: ${error.message}`);
  } else {
    if (!str(fd, "sort_order")) {
      const { data: last } = await supabase.from("menu_items").select("sort_order").eq("category_id", row.category_id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
      row.sort_order = (last?.sort_order ?? 0) + 10;
    }
    const { error } = await supabase.from("menu_items").insert(row);
    if (error) return fail(`Uložení selhalo: ${error.message}`);
  }
  done("/admin/nabidka");
  return ok(idRaw ? "Položka je uložená." : `Položka „${row.name}“ byla přidána.`);
}

export async function deleteItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) return fail("Neplatná položka.");
  const { error } = await supabase.from("menu_items").delete().eq("id", id.data);
  if (error) return fail(`Smazání selhalo: ${error.message}`);
  done("/admin/nabidka");
  return ok("Položka byla smazána.");
}

// ---------------------------------------------------------------------
// Prostory
// ---------------------------------------------------------------------
export async function saveSpace(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  const name = str(fd, "name");
  const capacityRaw = str(fd, "capacity");
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  if (!id.success || !name) return fail("Vyplňte název prostoru.");
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 5000)) return fail("Kapacita musí být celé kladné číslo.");
  const cover = optStr(fd, "cover_path");
  if (cover && !MEDIA_PATH.test(cover)) return fail("Neplatná fotografie.");
  const { error } = await supabase
    .from("spaces")
    .update({
      name,
      description: optStr(fd, "description"),
      capacity,
      capacity_note: optStr(fd, "capacity_note"),
      cover_path: cover,
      sort_order: Number(str(fd, "sort_order")) || 0,
      is_visible: bool(fd, "is_visible"),
    })
    .eq("id", id.data);
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  done("/admin/prostory");
  return ok(`Prostor „${name}“ je uložený.`);
}

export async function createSpace(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const name = str(fd, "name");
  if (!name) return fail("Vyplňte název prostoru.");
  const slug =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "prostor";
  const { error } = await supabase.from("spaces").insert({ name, slug: `${slug}-${Date.now().toString(36).slice(-4)}`, sort_order: 100 });
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  done("/admin/prostory");
  return ok(`Prostor „${name}“ byl přidán.`);
}

export async function deleteSpace(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) return fail("Neplatný prostor.");
  const { error } = await supabase.from("spaces").delete().eq("id", id.data);
  if (error) return fail(`Smazání selhalo: ${error.message}`);
  done("/admin/prostory");
  return ok("Prostor byl smazán.");
}

// ---------------------------------------------------------------------
// Sportovní přenosy
// ---------------------------------------------------------------------
export async function saveSportEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const date = str(fd, "date");
  const t = str(fd, "time");
  const sport = str(fd, "sport");
  const title = str(fd, "title");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time.safeParse(t).success) return fail("Vyplňte datum a čas přenosu.");
  if (!sport || sport.length > 60) return fail("Vyplňte sport.");
  if (!title || title.length > 200) return fail("Vyplňte název události.");
  const row = {
    starts_at: pragueLocalToUtcIso(`${date}T${t}`),
    sport,
    title,
    description: optStr(fd, "description"),
    is_visible: str(fd, "id") ? bool(fd, "is_visible") : true,
  };
  const idRaw = str(fd, "id");
  if (idRaw && !uuid.safeParse(idRaw).success) return fail("Neplatný přenos.");
  const { error } = idRaw
    ? await supabase.from("sport_events").update(row).eq("id", idRaw)
    : await supabase.from("sport_events").insert(row);
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  done("/admin/sport");
  return ok(idRaw ? "Přenos je uložený." : "Přenos byl přidán.");
}

export async function deleteSportEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) return fail("Neplatný přenos.");
  const { error } = await supabase.from("sport_events").delete().eq("id", id.data);
  if (error) return fail(`Smazání selhalo: ${error.message}`);
  done("/admin/sport");
  return ok("Přenos byl smazán.");
}

// ---------------------------------------------------------------------
// Fotogalerie
// ---------------------------------------------------------------------
export async function registerPhotos(
  photos: { path: string; width: number; height: number; alt: string }[],
  category: string,
  spaceId: string | null,
): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  if (!GALLERY_CATEGORIES.some((c) => c.key === category)) return fail("Neplatná kategorie.");
  if (spaceId && !uuid.safeParse(spaceId).success) return fail("Neplatný prostor.");
  const rows = photos
    .filter((p) => MEDIA_PATH.test(p.path) && p.path.startsWith("gallery/"))
    .map((p) => ({
      storage_path: p.path,
      width: Math.round(p.width) || null,
      height: Math.round(p.height) || null,
      alt: p.alt.slice(0, 200),
      category,
      space_id: spaceId,
    }));
  if (!rows.length) return fail("Žádná platná fotografie.");
  const { error } = await supabase.from("gallery_photos").insert(rows);
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  done("/admin/galerie");
  return ok(rows.length === 1 ? "Fotografie byla přidána." : `Přidáno ${rows.length} fotografií.`);
}

export async function updatePhoto(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  const category = str(fd, "category");
  const spaceRaw = str(fd, "space_id");
  if (!id.success || !GALLERY_CATEGORIES.some((c) => c.key === category)) return fail("Neplatná data.");
  if (spaceRaw && !uuid.safeParse(spaceRaw).success) return fail("Neplatný prostor.");
  const { error } = await supabase
    .from("gallery_photos")
    .update({
      alt: str(fd, "alt").slice(0, 200),
      category,
      space_id: spaceRaw || null,
      sort_order: Number(str(fd, "sort_order")) || 0,
      is_visible: bool(fd, "is_visible"),
    })
    .eq("id", id.data);
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  done("/admin/galerie");
  return ok("Fotografie je uložená.");
}

export async function deletePhoto(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) return fail("Neplatná fotografie.");
  const { data, error } = await supabase.from("gallery_photos").delete().eq("id", id.data).select("storage_path").maybeSingle();
  if (error) return fail(`Smazání selhalo: ${error.message}`);
  if (data?.storage_path) {
    // soubor smažeme, jen pokud ho nepoužívá jako titulní foto některý prostor
    const { count } = await supabase.from("spaces").select("id", { count: "exact", head: true }).eq("cover_path", data.storage_path);
    if (!count) await supabase.storage.from("media").remove([data.storage_path]);
  }
  done("/admin/galerie");
  return ok("Fotografie byla smazána.");
}

// ---------------------------------------------------------------------
// Poptávky
// ---------------------------------------------------------------------
export async function setInquiryStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  const status = str(fd, "status");
  if (!id.success || (status !== "new" && status !== "handled")) return fail("Neplatná data.");
  const { error } = await supabase.from("inquiries").update({ status }).eq("id", id.data);
  if (error) return fail(`Uložení selhalo: ${error.message}`);
  revalidatePath("/admin", "layout");
  return ok(status === "handled" ? "Označeno jako vyřízené." : "Označeno jako nové.");
}

export async function deleteInquiry(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) return fail("Neplatná poptávka.");
  const { error } = await supabase.from("inquiries").delete().eq("id", id.data);
  if (error) return fail(`Smazání selhalo: ${error.message}`);
  revalidatePath("/admin", "layout");
  return ok("Poptávka byla smazána.");
}
