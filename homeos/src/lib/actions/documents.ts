"use server";
import { z } from "zod";
import { enumOf, text, optText, uuid } from "@/lib/validation";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES as MAX_BYTES } from "@/lib/documents-meta";
import { done, fail, own, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";


const registerSchema = z.object({
  storage_path: z.string().min(10).max(400),
  file_name: z.string().min(1).max(200),
  mime_type: z.string().refine((m) => ALLOWED_MIME.includes(m), "Nepodporovaný typ souboru"),
  size_bytes: z.number().int().min(1).max(MAX_BYTES, "Soubor je větší než 15 MB"),
  kind: enumOf(["invoice", "receipt", "contract", "statement", "other"]),
  title: z.string().max(200).optional(),
});

/** Zápis dokumentu nahraného přímo z prohlížeče do Supabase Storage (cesta musí ležet ve složce domácnosti). */
export async function registerDocument(input: z.input<typeof registerSchema>): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(registerSchema, input as Record<string, unknown>);
    if (!p.ok) return p.result;
    const d = p.data;
    if (!d.storage_path.startsWith(`${ctx.household.id}/`) || d.storage_path.includes("..")) return fail("Neplatná cesta souboru.");
    const file = await ctx.store.files.download(d.storage_path);
    if (!file) return fail("Soubor se nepodařilo najít v úložišti.");
    const [doc] = await ctx.store.insert("documents", [{
      household_id: ctx.household.id, kind: d.kind, title: d.title?.trim() || d.file_name, storage_path: d.storage_path,
      file_name: d.file_name, mime_type: d.mime_type, size_bytes: d.size_bytes, ocr_text: null, tags: null, uploaded_by: ctx.user.id,
    }]);
    return done("Dokument nahrán", doc.id);
  });
}

const updateSchema = z.object({ id: uuid(), title: text(200), kind: enumOf(["invoice", "receipt", "contract", "statement", "other"]), tags: optText(300) });

export async function updateDocument(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(updateSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    await own(ctx, "documents", id);
    await ctx.store.update("documents", { id, household_id: ctx.household.id }, row);
    return done("Dokument upraven");
  });
}

export async function saveOcrText(id: string, ocrText: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "documents", id);
    await ctx.store.update("documents", { id, household_id: ctx.household.id }, { ocr_text: ocrText.slice(0, 50_000) });
    return { ok: true, at: Date.now() };
  });
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const doc = await own(ctx, "documents", id);
    await ctx.store.remove("documents", { id, household_id: ctx.household.id });
    await ctx.store.files.remove((doc as { storage_path: string }).storage_path).catch(() => undefined);
    return done("Dokument smazán");
  });
}
