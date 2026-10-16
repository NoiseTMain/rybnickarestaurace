import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, requireAdminApi } from "@/lib/auth";
import { revalidatePublicSite } from "@/lib/menus";

export const dynamic = "force-dynamic";

/** Smaže menu z historie včetně souboru v úložišti (UI vyžaduje potvrzení). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Neplatný původ požadavku." }, { status: 403 });
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Neplatné ID menu." }, { status: 400 });

  const { data: menu, error } = await admin.supabase
    .from("daily_menus")
    .delete()
    .eq("id", id.data)
    .select("storage_path,is_current")
    .maybeSingle();
  if (error) return NextResponse.json({ error: `Menu se nepodařilo smazat: ${error.message}` }, { status: 500 });
  if (!menu) return NextResponse.json({ error: "Menu nebylo nalezeno." }, { status: 404 });

  const { error: storageError } = await admin.supabase.storage.from("menus").remove([menu.storage_path]);
  if (storageError) console.error("[api/menus] storage remove failed", storageError);
  if (menu.is_current) revalidatePublicSite();

  return NextResponse.json({ deleted: true, wasCurrent: menu.is_current, fileRemoved: !storageError });
}
