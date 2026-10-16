import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * Obnovuje přihlašovací relaci Supabase a nepřihlášené uživatele
 * přesměruje z /admin na přihlášení. Jde jen o první vrstvu – oprávnění
 * se vždy znovu ověřují na serveru (requireAdmin) a v databázi (RLS).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;
  const isPublicAdminPage = pathname === "/admin/prihlaseni" || pathname === "/admin/obnova-hesla";

  if (pathname.startsWith("/admin") && !isPublicAdminPage && !isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/prihlaseni";
    url.search = "";
    return NextResponse.redirect(url);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/auth/:path*"],
};
