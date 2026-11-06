"use server";
import { restoreBackup, type Backup } from "@/lib/backup";
import { done, fail, withContext } from "./helpers";
import type { ActionResult } from "./result";

export async function restoreFromBackup(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    if (ctx.role !== "owner") return fail("Obnovu zálohy může provést jen vlastník domácnosti.");
    if (String(fd.get("confirm") ?? "") !== "OBNOVIT") return fail("Pro potvrzení napište OBNOVIT.", { confirm: "Napište OBNOVIT" });
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("Vyberte soubor zálohy.", { file: "Vyberte soubor" });
    if (file.size > 50 * 1024 * 1024) return fail("Záloha je větší než 50 MB.");
    let backup: Backup;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      return fail("Soubor není platný JSON.");
    }
    const { counts, skippedDocuments } = await restoreBackup(ctx, backup);
    return done(
      `Záloha obnovena: ${counts.transactions ?? 0} transakcí, ${counts.invoices ?? 0} faktur, ${counts.work_shifts ?? 0} směn.` +
        (skippedDocuments ? ` ${skippedDocuments} dokumentů bez souboru nebylo obnoveno.` : ""),
    );
  });
}
