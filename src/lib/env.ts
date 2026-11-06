/**
 * Veřejné proměnné (bezpečné pro prohlížeč). Tajné klíče sem NEPATŘÍ.
 *
 * Výchozí hodnoty jsou veřejná adresa a veřejný „anon“ klíč produkčního
 * projektu Supabase – ten je určený pro prohlížeč, přístup k datům hlídá
 * Row Level Security. Proměnné prostředí je mohou přepsat (jiný projekt).
 */
const DEFAULT_SUPABASE_URL = "https://dlggrvqamwcxcthzuctn.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZ2dydnFhbXdjeGN0aHp1Y3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5OTQ0OTksImV4cCI6MjEwOTU3MDQ5OX0.sC_3OZQeTscWC6EruKi1NurlcYmlL-05hltntseoYA0";

/** Lokální souborový režim jen na výslovné vyžádání (vývoj bez internetu, automatické testy). */
const LOCAL_MODE = process.env.NEXT_PUBLIC_HOMEOS_LOCAL_MODE === "1";

export const publicEnv = {
  supabaseUrl: LOCAL_MODE ? "" : process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
  supabaseAnonKey: LOCAL_MODE ? "" : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
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
  return appMode() === "local" && process.env.VERCEL === "1";
}
