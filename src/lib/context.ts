import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { appMode } from "@/lib/env";
import { getUser, mfaPending, type AppUser } from "@/lib/auth";
import type { Store } from "@/lib/db/store";
import type { Household, PermissionSection, Permissions } from "@/lib/db/types";

export const HOUSEHOLD_COOKIE = "homeos_household";

export interface AppContext {
  user: AppUser;
  store: Store;
  households: Household[];
  household: Household;
  role: "owner" | "member";
  permissions: Permissions;
}

/** Může uživatel upravovat danou sekci? Vlastník vždy; připojený člen podle oprávnění (výchozí plná). */
export function canEdit(ctx: Pick<AppContext, "role" | "permissions">, section: PermissionSection): boolean {
  return ctx.role === "owner" || (ctx.permissions[section] ?? "edit") === "edit";
}

export const getStore = cache(async (user: AppUser): Promise<Store> => {
  if (appMode() === "local") {
    const { createLocalStore } = await import("@/lib/db/local-store");
    return createLocalStore(user.id);
  }
  const { createSessionClient } = await import("@/lib/supabase/server");
  const { createSupabaseStore } = await import("@/lib/db/supabase-store");
  return createSupabaseStore(await createSessionClient());
});

/** Přihlášený uživatel + jeho úložiště (bez nutnosti mít domácnost). */
export const requireUser = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/prihlaseni");
  if (await mfaPending()) redirect("/prihlaseni/overeni");
  return { user, store: await getStore(user) };
});

/** Kontext bez přesměrování (pro API): null = nepřihlášen, "no_household" = chybí domácnost. */
export const tryContext = cache(async (): Promise<AppContext | null | "no_household"> => {
  const user = await getUser();
  if (!user) return null;
  if (await mfaPending()) return null;
  const store = await getStore(user);
  const [memberships, allHouseholds] = await Promise.all([store.select("household_users", { user_id: user.id }), store.select("households")]);
  const households = allHouseholds.filter((h) => memberships.some((m) => m.household_id === h.id));
  if (!households.length) return "no_household";
  const jar = await cookies();
  const wanted = jar.get(HOUSEHOLD_COOKIE)?.value;
  households.sort((a, b) => Number(a.is_demo) - Number(b.is_demo) || a.created_at.localeCompare(b.created_at));
  const household = households.find((h) => h.id === wanted) ?? households[0];
  const membership = memberships.find((m) => m.household_id === household.id);
  const role = membership?.role ?? "member";
  return { user, store, households, household, role, permissions: (membership?.permissions ?? {}) as Permissions };
});

/** Kontext s aktuální domácností. Bez přihlášení → přihlášení, bez domácnosti → úvodní nastavení. */
export const requireContext = cache(async (): Promise<AppContext> => {
  const ctx = await tryContext();
  if (ctx === null) redirect((await getUser()) ? "/prihlaseni/overeni" : "/prihlaseni");
  if (ctx === "no_household") redirect("/uvod");
  return ctx;
});

/** Pro route handlery: kontext, nebo HTTP odpověď 401/403. */
export async function apiContext(): Promise<AppContext | Response> {
  const ctx = await tryContext();
  if (ctx === null) return Response.json({ error: "Nepřihlášeno" }, { status: 401 });
  if (ctx === "no_household") return Response.json({ error: "Nemáte přístup k žádné domácnosti" }, { status: 403 });
  return ctx;
}
