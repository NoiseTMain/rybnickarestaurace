import "server-only";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AdminContext } from "@/lib/auth";
import { inspectPng } from "@/lib/png";
import { addDays, isValidIsoDate, pragueToday } from "@/lib/time";
import type { DailyMenu } from "@/lib/types";

/** Cesta v bucketu „menus“: 2026/10/2026-10-16_<uuid>.png */
export const MENU_PATH_RE = /^(\d{4})\/(\d{2})\/(\d{4}-\d{2}-\d{2})_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;

export const registerMenuSchema = z.object({
  storagePath: z.string().regex(MENU_PATH_RE, "Neplatná cesta k souboru"),
  originalFilename: z.string().trim().min(1).max(200),
  menuDate: z.string().refine(isValidIsoDate, "Neplatné datum menu"),
});

/** Menu lze nahrát nejvýše 60 dní zpět a 30 dní dopředu (ochrana proti překlepům). */
export function checkMenuDateRange(menuDate: string, today = pragueToday()): string | null {
  if (menuDate < addDays(today, -60)) return "Datum menu je příliš v minulosti.";
  if (menuDate > addDays(today, 30)) return "Datum menu je příliš daleko v budoucnosti.";
  return null;
}

/** Obnoví cache veřejného webu, aby se změna projevila okamžitě. */
export function revalidatePublicSite() {
  revalidatePath("/", "layout");
}

export class MenuError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/**
 * Ověří nahraný soubor přímo v úložišti (skutečný obsah PNG, velikost,
 * rozměry), založí záznam v historii a zveřejní ho.
 */
export async function registerAndPublishMenu(
  { supabase, user }: AdminContext,
  input: z.infer<typeof registerMenuSchema>,
): Promise<DailyMenu> {
  const match = MENU_PATH_RE.exec(input.storagePath)!;
  if (match[3] !== input.menuDate) throw new MenuError("Cesta k souboru neodpovídá datu menu.");
  const rangeError = checkMenuDateRange(input.menuDate);
  if (rangeError) throw new MenuError(rangeError);

  const bucket = supabase.storage.from("menus");
  const { data: file, error: downloadError } = await bucket.download(input.storagePath);
  if (downloadError || !file) {
    throw new MenuError("Nahraný soubor nebyl v úložišti nalezen. Zkuste menu nahrát znovu.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = inspectPng(bytes);
  if (!check.ok) {
    await bucket.remove([input.storagePath]);
    throw new MenuError(check.error);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const { data: inserted, error: insertError } = await supabase
    .from("daily_menus")
    .insert({
      menu_date: input.menuDate,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      file_size: bytes.byteLength,
      width: check.width,
      height: check.height,
      sha256,
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    if (insertError?.code === "23505") throw new MenuError("Tento soubor už je v historii uložený.", 409);
    throw new MenuError(`Menu se nepodařilo uložit: ${insertError?.message ?? "neznámá chyba"}`, 500);
  }

  // Záznam v historii existuje, i kdyby zveřejnění selhalo – lze ho pak zveřejnit z historie.
  return publishMenu(supabase, inserted.id);
}

export async function publishMenu(supabase: AdminContext["supabase"], menuId: string): Promise<DailyMenu> {
  const { data, error } = await supabase.rpc("publish_menu", { p_menu_id: menuId });
  if (error || !data) {
    throw new MenuError(`Menu se nepodařilo zveřejnit: ${error?.message ?? "neznámá chyba"}`, 500);
  }
  revalidatePublicSite();
  return data as DailyMenu;
}
