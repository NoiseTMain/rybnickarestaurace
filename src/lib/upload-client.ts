"use client";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, safeFileName } from "@/lib/documents-meta";
import { registerDocument } from "@/lib/actions/documents";
import type { DocumentRow } from "@/lib/db/types";

/** Zmenšení velkých fotek (účtenky z mobilu) – šetří místo a zrychlí OCR. */
async function maybeCompress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 2.5 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export interface UploadContext {
  mode: "supabase" | "local";
  householdId: string;
}

/** Nahraje soubor do soukromého úložiště domácnosti a vrátí id dokumentu. */
export async function uploadDocument(original: File, kind: DocumentRow["kind"], ctx: UploadContext, title?: string): Promise<string> {
  const mime = original.type || (original.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  if (!ALLOWED_MIME.includes(mime)) throw new Error("Podporované jsou PDF a obrázky (JPG, PNG, WEBP, HEIC).");
  const file = await maybeCompress(original);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Soubor je větší než 15 MB.");
  if (ctx.mode === "local") {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    if (title) fd.set("title", title);
    const res = await fetch("/api/files", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Nahrání selhalo.");
    return json.id as string;
  }
  const { getBrowserClient } = await import("@/lib/supabase/browser");
  const path = `${ctx.householdId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await getBrowserClient().storage.from("documents").upload(path, file, { contentType: file.type || mime, upsert: false });
  if (error) throw new Error(`Nahrání selhalo: ${error.message}`);
  const r = await registerDocument({ storage_path: path, file_name: original.name.slice(0, 200), mime_type: file.type || mime, size_bytes: file.size, kind, title });
  if (!r.ok || !r.id) throw new Error(r.error ?? "Dokument se nepodařilo zaevidovat.");
  return r.id;
}
