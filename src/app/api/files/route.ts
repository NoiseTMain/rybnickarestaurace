import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiContext } from "@/lib/context";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, safeFileName } from "@/lib/documents-meta";

const KINDS = ["invoice", "receipt", "contract", "statement", "other"] as const;

/** Nahrání souboru přes server – používá se v lokálním režimu (v Supabase nahrává prohlížeč přímo do Storage). */
export async function POST(req: Request) {
  const ctx = await apiContext();
  if (ctx instanceof Response) return ctx;
  const fd = await req.formData();
  const file = fd.get("file");
  const kind = String(fd.get("kind") ?? "other") as (typeof KINDS)[number];
  if (!(file instanceof File)) return NextResponse.json({ error: "Chybí soubor" }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ error: "Nepodporovaný typ souboru" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Soubor je větší než 15 MB" }, { status: 400 });
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Neplatný druh" }, { status: 400 });
  const path = `${ctx.household.id}/${randomUUID()}-${safeFileName(file.name)}`;
  await ctx.store.files.upload(path, new Uint8Array(await file.arrayBuffer()), file.type);
  const title = String(fd.get("title") ?? "").trim() || file.name;
  const [doc] = await ctx.store.insert("documents", [{
    household_id: ctx.household.id, kind, title: title.slice(0, 200), storage_path: path, file_name: file.name.slice(0, 200),
    mime_type: file.type, size_bytes: file.size, ocr_text: null, tags: null, uploaded_by: ctx.user.id,
  }]);
  return NextResponse.json({ id: doc.id });
}
