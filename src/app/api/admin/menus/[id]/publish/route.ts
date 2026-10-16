import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, requireAdminApi } from "@/lib/auth";
import { MenuError, publishMenu } from "@/lib/menus";

export const dynamic = "force-dynamic";

/** Znovu zveřejní vybrané menu z historie (e-mail se neposílá automaticky). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Neplatný původ požadavku." }, { status: 403 });
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Neplatné ID menu." }, { status: 400 });

  try {
    const menu = await publishMenu(admin.supabase, id.data);
    return NextResponse.json({ menu, published: true });
  } catch (e) {
    const status = e instanceof MenuError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Neznámá chyba" }, { status });
  }
}
