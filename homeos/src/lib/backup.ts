import "server-only";
import { randomUUID } from "node:crypto";
import type { AppContext } from "@/lib/context";
import { HOUSEHOLD_TABLES, type HouseholdTable } from "@/lib/db/types";
import { REFS } from "@/lib/db/schema-meta";
import { DbError } from "@/lib/db/store";

export const BACKUP_FORMAT = "homeos-backup";
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exported_at: string;
  household: { id: string; name: string; is_demo: boolean };
  tables: Partial<Record<HouseholdTable, Record<string, unknown>[]>>;
  files?: Record<string, { mime: string; base64: string }>;
}

export async function createBackup(ctx: AppContext, withFiles: boolean): Promise<Backup> {
  const tables: Backup["tables"] = {};
  for (const t of HOUSEHOLD_TABLES) {
    tables[t] = (await ctx.store.select(t, { household_id: ctx.household.id } as never)) as unknown as Record<string, unknown>[];
  }
  const backup: Backup = {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, exported_at: new Date().toISOString(),
    household: { id: ctx.household.id, name: ctx.household.name, is_demo: ctx.household.is_demo }, tables,
  };
  if (withFiles) {
    backup.files = {};
    for (const d of tables.documents ?? []) {
      const f = await ctx.store.files.download(String(d.storage_path));
      if (f) backup.files[String(d.storage_path)] = { mime: f.mime, base64: Buffer.from(f.bytes).toString("base64") };
    }
  }
  return backup;
}

/** Sloupce, které nejsou datová pole (generuje databáze). */
const STRIP = new Set(["updated_at"]);

/**
 * Obnova zálohy do AKTUÁLNÍ domácnosti: všechna stávající data domácnosti
 * se nahradí obsahem zálohy. Identifikátory se přegenerují (záloha jde
 * obnovit i do jiné domácnosti), vazby se přemapují.
 */
export async function restoreBackup(ctx: AppContext, backup: Backup): Promise<{ counts: Record<string, number>; skippedDocuments: number }> {
  if (backup?.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || typeof backup.tables !== "object") {
    throw new DbError("check", "Soubor není platná záloha HomeOS.");
  }
  const hid = ctx.household.id;
  const sameHousehold = backup.household?.id === hid;
  const idMap = new Map<string, string>();
  const src: Partial<Record<HouseholdTable, Record<string, unknown>[]>> = {};
  for (const t of HOUSEHOLD_TABLES) {
    const rows = backup.tables[t] ?? [];
    if (!Array.isArray(rows)) throw new DbError("check", `Poškozená záloha (${t}).`);
    src[t] = rows;
    for (const r of rows) if (typeof r.id === "string") idMap.set(r.id, randomUUID());
  }

  // dokumenty: soubor musí existovat (v záloze nebo v úložišti stejné domácnosti)
  let skippedDocuments = 0;
  const docRows: Record<string, unknown>[] = [];
  const uploads: { path: string; mime: string; bytes: Uint8Array }[] = [];
  for (const d of src.documents ?? []) {
    const oldPath = String(d.storage_path);
    const rest = oldPath.split("/").slice(1).join("/");
    const newPath = `${hid}/${randomUUID().slice(0, 8)}-${rest.split("/").pop()}`;
    const file = backup.files?.[oldPath];
    if (file) {
      uploads.push({ path: newPath, mime: file.mime, bytes: new Uint8Array(Buffer.from(file.base64, "base64")) });
      docRows.push({ ...d, storage_path: newPath });
    } else if (sameHousehold && (await ctx.store.files.download(oldPath))) {
      docRows.push({ ...d, storage_path: oldPath, __keepPath: true });
    } else {
      skippedDocuments++;
      idMap.delete(String(d.id));
    }
  }
  src.documents = docRows;

  const remap = (t: HouseholdTable, r: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) if (!STRIP.has(k) && k !== "__keepPath") out[k] = v;
    out.id = idMap.get(String(r.id)) ?? randomUUID();
    out.household_id = hid;
    for (const ref of REFS[t] ?? []) {
      const v = r[ref.column];
      if (v == null) continue;
      out[ref.column] = idMap.get(String(v)) ?? null;
    }
    if (t === "members") out.user_id = r.user_id === ctx.user.id ? ctx.user.id : null;
    if (t === "documents") out.uploaded_by = null;
    return out;
  };
  const prepared = Object.fromEntries(HOUSEHOLD_TABLES.map((t) => [t, (src[t] ?? []).map((r) => remap(t, r))])) as Record<HouseholdTable, Record<string, unknown>[]>;
  if (prepared.household_settings.length > 1 || prepared.work_settings.length > 1) throw new DbError("check", "Poškozená záloha (nastavení).");
  // transakce bez platného účtu nelze obnovit
  if (prepared.transactions.some((t) => t.account_id == null)) throw new DbError("check", "Záloha obsahuje transakce bez účtu.");

  // pojistka: aktuální stav pro případ selhání
  const current = await createBackup(ctx, false);
  const oldDocPaths = (current.tables.documents ?? []).map((d) => String(d.storage_path));
  const keptPaths = new Set(docRows.filter((d) => d.__keepPath).map((d) => String(d.storage_path)));

  for (const u of uploads) await ctx.store.files.upload(u.path, u.bytes, u.mime);
  const wipe = async () => {
    for (const t of [...HOUSEHOLD_TABLES].reverse()) await ctx.store.remove(t, { household_id: hid } as never);
  };
  try {
    await wipe();
    for (const t of HOUSEHOLD_TABLES) if (prepared[t].length) await ctx.store.insert(t, prepared[t] as never);
  } catch (e) {
    // vrácení původního stavu
    await wipe().catch(() => undefined);
    for (const t of HOUSEHOLD_TABLES) {
      const rows = (current.tables[t] ?? []).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !STRIP.has(k))));
      if (rows.length) await ctx.store.insert(t, rows as never).catch(() => undefined);
    }
    for (const u of uploads) await ctx.store.files.remove(u.path).catch(() => undefined);
    throw e;
  }
  for (const p of oldDocPaths) if (!keptPaths.has(p)) await ctx.store.files.remove(p).catch(() => undefined);
  const counts = Object.fromEntries(HOUSEHOLD_TABLES.map((t) => [t, prepared[t].length]));
  return { counts, skippedDocuments };
}
