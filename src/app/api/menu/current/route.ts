import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Lehký endpoint, podle kterého se veřejná stránka sama obnoví po zveřejnění nového menu. */
export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ id: null, publishedAt: null });
  const { data } = await createPublicClient()
    .from("daily_menus")
    .select("id,published_at")
    .eq("is_current", true)
    .maybeSingle();
  return NextResponse.json(
    { id: data?.id ?? null, publishedAt: data?.published_at ?? null },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=20, stale-while-revalidate=40" } },
  );
}
