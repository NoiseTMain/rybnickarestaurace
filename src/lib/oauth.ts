/** Poskytovatelé přihlášení (Google, Apple) zapnutí na serveru – NEXT_PUBLIC_OAUTH_PROVIDERS="google,apple". */
export function oauthProviders(): ("google" | "apple")[] {
  return (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "").split(",").map((s) => s.trim()).filter((s): s is "google" | "apple" => s === "google" || s === "apple");
}
