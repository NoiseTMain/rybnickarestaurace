"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/dict";

/** Uloží jazyk (cookie; přihlášenému i do předvoleb). Funguje i bez přihlášení. */
export async function setLocale(locale: Locale): Promise<void> {
  if (!["cs", "sk", "en"].includes(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  try {
    const { tryContext } = await import("@/lib/context");
    const ctx = await tryContext();
    if (ctx && ctx !== "no_household") {
      const { savePrefs } = await import("@/lib/prefs");
      await savePrefs(ctx.store, ctx.user, { locale });
    }
  } catch {
    /* nepřihlášený uživatel – stačí cookie */
  }
  revalidatePath("/", "layout");
}
