"use server";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme, serializeTheme, type Theme } from "@/lib/theme";
import { FREE_ACCENTS, FREE_BACKGROUNDS, FREE_SCENES } from "@/lib/plans";

/** Uloží zvolený vzhled do cookie tohoto zařízení (platí rok). Hodnoty se znovu validují. */
export async function saveTheme(theme: Theme): Promise<{ ok: boolean }> {
  const clean = parseTheme(serializeTheme(theme));
  const { requireContext } = await import("@/lib/context");
  const { getPremium } = await import("@/lib/premium");
  if (!(await getPremium(await requireContext())).household) {
    // verze zdarma: jen základní barvy a pozadí
    if (!FREE_ACCENTS.includes(clean.accent)) clean.accent = "champagne";
    if (!FREE_BACKGROUNDS.includes(clean.bg)) clean.bg = "anthracite";
    if (!FREE_SCENES.includes(clean.scene)) clean.scene = "none";
  }
  (await cookies()).set(THEME_COOKIE, serializeTheme(clean), { path: "/", sameSite: "lax", maxAge: 365 * 86_400 });
  return { ok: true };
}
