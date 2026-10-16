import { publicEnv } from "@/lib/env";

export type Bucket = "menus" | "media";

/** Veřejná URL souboru v Supabase Storage. */
export function publicFileUrl(bucket: Bucket, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path) || path.startsWith("/")) return path;
  if (!publicEnv.supabaseUrl) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
}

/** URL, která vynutí stažení souboru s daným názvem. */
export function downloadFileUrl(bucket: Bucket, path: string, filename: string): string | null {
  const url = publicFileUrl(bucket, path);
  return url ? `${url}?download=${encodeURIComponent(filename)}` : null;
}
