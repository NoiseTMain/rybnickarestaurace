import { NextResponse } from "next/server";
import { apiContext } from "@/lib/context";

/** Stažení dokumentu – jen pro členy domácnosti (kontrola přes RLS / lokální pravidla). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Neplatné id" }, { status: 400 });
  const ctx = await apiContext();
  if (ctx instanceof Response) return ctx;
  const [doc] = await ctx.store.select("documents", { id, household_id: ctx.household.id });
  if (!doc) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  const file = await ctx.store.files.download(doc.storage_path);
  if (!file) return NextResponse.json({ error: "Soubor chybí v úložišti" }, { status: 404 });
  const download = new URL(req.url).searchParams.has("stahnout");
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": doc.mime_type,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
