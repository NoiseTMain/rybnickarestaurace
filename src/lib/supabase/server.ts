import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

/**
 * Klient s relací přihlášeného uživatele (cookies). Všechny dotazy
 * podléhají RLS – administrátor má práva jen díky záznamu v admin_users.
 */
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Volání ze Server Component – cookies obnovuje proxy.ts
        }
      },
    },
  });
}

/**
 * Anonymní klient bez cookies pro veřejné stránky – díky tomu je lze
 * cachovat (ISR) a nevidí nic, co RLS nepovoluje veřejnosti.
 */
export function createPublicClient() {
  return createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Klient se service role – obchází RLS. Používá se VÝHRADNĚ na serveru
 * pro vložení veřejné poptávky po validaci. Klíč se nikdy neposílá do prohlížeče.
 */
export function createServiceClient() {
  if (!serverEnv.supabaseServiceRoleKey) {
    throw new Error("Chybí SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
