import { recipeById } from "@/lib/recipes";
import { dishSvg } from "@/lib/recipes/illustration";

/**
 * Ilustrace receptu (SVG) podle surovin a gramáží. Neobsahuje žádná data uživatele,
 * proto je veřejná a dlouho se cachuje (adresa končí .svg → proxy ji nepouští přes přihlášení).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const r = file.endsWith(".svg") ? recipeById(file.slice(0, -4)) : null;
  if (!r) return new Response("Nenalezeno", { status: 404 });
  return new Response(dishSvg(r), {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" },
  });
}
