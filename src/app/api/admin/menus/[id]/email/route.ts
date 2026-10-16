import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, requireAdminApi } from "@/lib/auth";
import { sendMenuEmail } from "@/lib/email/menu-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({ force: z.boolean().optional() });

/**
 * Ruční (opakované) odeslání menu e-mailem. Již odeslané menu se odešle
 * znovu jen s výslovným potvrzením (force: true).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Neplatný původ požadavku." }, { status: 403 });
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Neplatné ID menu." }, { status: 400 });
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));

  const email = await sendMenuEmail(admin, id.data, { trigger: "manual", force: body.success && body.data.force });
  const status = email.status === "failed" ? 502 : email.status === "busy" ? 409 : 200;
  return NextResponse.json({ email }, { status });
}
