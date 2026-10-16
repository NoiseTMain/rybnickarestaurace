import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

type SessionClient = Awaited<ReturnType<typeof createSessionClient>>;
export type AdminContext = { supabase: SessionClient; user: User };

/** Ověří přihlášení (proti Supabase Auth) a roli administrátora. */
export async function getAdmin(): Promise<AdminContext | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSessionClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) return null;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return null;
  return { supabase, user: userData.user };
}

/** Pro stránky a server actions administrace. */
export async function requireAdmin(): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/prihlaseni");
  return admin;
}

/** Pro API endpointy: vrací buď kontext, nebo hotovou odpověď 401. */
export async function requireAdminApi(): Promise<AdminContext | NextResponse> {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Nejste přihlášeni jako administrátor." }, { status: 401 });
  }
  return admin;
}

/**
 * Ochrana proti CSRF u API: požadavek musí přijít ze stejného originu.
 * (Cookies Supabase jsou SameSite=Lax, toto je druhá vrstva.)
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
