import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

/** Ověření odkazu z e-mailu Supabase (obnova hesla, pozvánka). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/admin";
  // jen relativní cesty v rámci /admin – ochrana proti open redirect
  const next = nextParam.startsWith("/admin") ? nextParam : "/admin";

  const supabase = await createSessionClient();
  let ok = false;
  if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }
  const url = request.nextUrl.clone();
  url.search = "";
  url.pathname = ok ? next : "/admin/prihlaseni";
  return NextResponse.redirect(url);
}
