import "server-only";
import { createClient } from "@supabase/supabase-js";
import { appMode, publicEnv } from "@/lib/env";
import { verifyPassword } from "@/lib/auth";
import type { AppUser } from "@/lib/auth";

/**
 * Ověření hesla přihlášeného uživatele pro citlivé akce (reset, změna IČO).
 * V Supabase se použije samostatný klient bez cookies – stávající přihlášení se nemění.
 */
export async function checkPassword(user: AppUser, password: string): Promise<boolean> {
  if (!password) return false;
  if (appMode() === "local") {
    const { readLocal } = await import("@/lib/db/local-store");
    const stored = await readLocal((d) => d.users.find((u) => u.id === user.id)?.password_hash);
    return stored ? verifyPassword(password, stored) : false;
  }
  if (!user.email) return false;
  const client = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password });
  if (error || data.user?.id !== user.id) return false;
  await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  return true;
}
