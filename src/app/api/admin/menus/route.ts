import { NextResponse } from "next/server";
import { isSameOrigin, requireAdminApi } from "@/lib/auth";
import { sendMenuEmail } from "@/lib/email/menu-email";
import { MenuError, registerAndPublishMenu, registerMenuSchema } from "@/lib/menus";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Zaregistruje PNG, které administrátor nahrál do úložiště, zveřejní ho
 * a odešle e-mailem. Zveřejnění se provede i při selhání e-mailu.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Neplatný původ požadavku." }, { status: 403 });
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;

  const parsed = registerMenuSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neplatná data." }, { status: 400 });
  }

  let menu;
  try {
    menu = await registerAndPublishMenu(admin, parsed.data);
  } catch (e) {
    const status = e instanceof MenuError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Neznámá chyba";
    console.error("[api/menus] publish failed", message);
    return NextResponse.json({ error: message }, { status });
  }

  const email = await sendMenuEmail(admin, menu.id, { trigger: "auto" });
  return NextResponse.json({ menu, published: true, email });
}
