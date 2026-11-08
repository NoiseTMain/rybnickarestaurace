import "server-only";
import { cookies, headers } from "next/headers";
import { translate, type Key, type Locale } from "./dict";

export const LOCALE_COOKIE = "homeos_locale";

/** Jazyk: uložená volba (cookie); slovenský prohlížeč → slovenština; jinak čeština (angličtina jen volbou). */
export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (c === "cs" || c === "sk" || c === "en") return c;
  const al = ((await headers()).get("accept-language") ?? "").toLowerCase();
  const first = al.split(",")[0]?.trim() ?? "";
  if (first.startsWith("sk")) return "sk";
  return "cs";
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: (key: Key, vars?: Record<string, string | number>) => translate(locale, key, vars) };
}
