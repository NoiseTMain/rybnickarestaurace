import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, localModeBlocked, publicEnv } from "@/lib/env";

const PUBLIC = ["/prihlaseni", "/registrace", "/obnova-hesla", "/auth/confirm", "/konfigurace", "/api/cron", "/api/billing/webhook", "/vitejte", "/podminky", "/soukromi", "/sdilene"];

/**
 * První vrstva ochrany: obnovení relace Supabase a přesměrování nepřihlášených.
 * Skutečná autorizace probíhá vždy znovu na serveru (getUser) a v databázi (RLS).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Na Vercelu bez Supabase by se data ztrácela → celá aplikace ukáže návod ke konfiguraci
  if (localModeBlocked() && pathname !== "/konfigurace") {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Aplikace není nakonfigurovaná" }, { status: 503 });
    const url = request.nextUrl.clone();
    url.pathname = "/konfigurace";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
  let response = NextResponse.next({ request });
  let loggedIn: boolean;

  if (isSupabaseConfigured()) {
    const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    loggedIn = Boolean(data?.claims?.sub);
  } else {
    loggedIn = request.cookies.has("homeos_local_session");
  }

  if (!isPublic && !loggedIn) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Nepřihlášeno" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? "/vitejte" : "/prihlaseni";
    url.search = "";
    return NextResponse.redirect(url);
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
