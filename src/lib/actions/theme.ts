"use server";
import { cookies } from "next/headers";
import { ACCENTS, BACKGROUNDS, THEME_COOKIE, type Accent, type Background } from "@/lib/theme";

/** Uloží zvolený vzhled do cookie tohoto zařízení (platí rok). */
export async function saveTheme(accent: string, bg: string): Promise<{ ok: boolean }> {
  if (!(accent in ACCENTS) || !(bg in BACKGROUNDS)) return { ok: false };
  (await cookies()).set(THEME_COOKIE, `${accent as Accent}:${bg as Background}`, { path: "/", sameSite: "lax", maxAge: 365 * 86_400 });
  return { ok: true };
}
