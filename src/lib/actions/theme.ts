"use server";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme, serializeTheme, type Theme } from "@/lib/theme";

/** Uloží zvolený vzhled do cookie tohoto zařízení (platí rok). Hodnoty se znovu validují. */
export async function saveTheme(theme: Theme): Promise<{ ok: boolean }> {
  const clean = parseTheme(serializeTheme(theme));
  (await cookies()).set(THEME_COOKIE, serializeTheme(clean), { path: "/", sameSite: "lax", maxAge: 365 * 86_400 });
  return { ok: true };
}
