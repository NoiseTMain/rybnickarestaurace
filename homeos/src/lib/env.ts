/** Veřejné proměnné (bezpečné pro prohlížeč). Tajné klíče sem NEPATŘÍ. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

export type AppMode = "supabase" | "local";

export function appMode(): AppMode {
  return isSupabaseConfigured() ? "supabase" : "local";
}

/** Lokální režim ukládá data na disk – na Vercelu (dočasný disk) by se ztratila. */
export function localModeBlocked(): boolean {
  return appMode() === "local" && process.env.VERCEL === "1" && process.env.HOMEOS_ALLOW_LOCAL_ON_VERCEL !== "1";
}
