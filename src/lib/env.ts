/**
 * Proměnné prostředí. Veřejné (NEXT_PUBLIC_*) se dostanou do prohlížeče,
 * ostatní jsou dostupné pouze na serveru (viz server-env.ts).
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.rybnickarestaurace.cz").replace(/\/$/, ""),
  /** Volitelná cesta k originálnímu logu v /public (např. /brand/logo.svg). */
  logoPath: process.env.NEXT_PUBLIC_LOGO_PATH ?? "",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
