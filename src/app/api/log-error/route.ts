import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { logAppError } from "@/lib/errors-log";

export async function POST(req: NextRequest) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 20_000) return NextResponse.json({ ok: false }, { status: 413 });
  let body: { message?: unknown; stack?: unknown; path?: unknown; digest?: unknown } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (typeof body.message !== "string" || !body.message) return NextResponse.json({ ok: false }, { status: 400 });
  const user = await getUser().catch(() => null);
  await logAppError({
    message: body.message,
    stack: typeof body.stack === "string" ? body.stack : null,
    path: typeof body.path === "string" ? body.path : null,
    digest: typeof body.digest === "string" ? body.digest : null,
    userAgent: req.headers.get("user-agent"),
    userId: user?.id ?? null,
  });
  return NextResponse.json({ ok: true });
}
