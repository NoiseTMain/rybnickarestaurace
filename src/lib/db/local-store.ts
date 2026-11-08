import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DbError, type FileStore, type Filter, type NewRow, type Row, type Store } from "./store";
import { REFS, TABLE_SECTION, TABLES_WITH_UPDATED_AT, UNIQUE } from "./schema-meta";
import { subscriptionActive } from "@/lib/subscription";
import type { TableName, Tables } from "./types";

/**
 * LOKÁLNÍ VÝVOJOVÝ REŽIM – data v souboru .data/homeos.json.
 * Používá se automaticky, pokud nejsou nastavené klíče Supabase.
 * Napodobuje pravidla databáze (unikátní klíče, vazby, přístup jen ke
 * vlastní domácnosti), aby se aplikace chovala stejně jako v produkci.
 * Není určen pro nasazení na Vercel (disk je tam dočasný).
 */

export interface LocalUser {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

interface LocalData {
  version: 1;
  secret: string;
  users: LocalUser[];
  tables: { [K in TableName]?: Tables[K][] };
}

export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.HOMEOS_DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), ".data"));
const DATA_FILE = path.join(DATA_DIR, "homeos.json");
const FILES_DIR = path.join(DATA_DIR, "files");

const g = globalThis as unknown as { __homeosLocal?: { data: LocalData | null; queue: Promise<unknown> } };
const state = (g.__homeosLocal ??= { data: null, queue: Promise.resolve() });

async function load(): Promise<LocalData> {
  if (state.data) return state.data;
  try {
    state.data = JSON.parse(await readFile(DATA_FILE, "utf8")) as LocalData;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    state.data = { version: 1, secret: randomUUID() + randomUUID(), users: [], tables: {} };
    await persist(state.data);
  }
  return state.data;
}

async function persist(data: LocalData) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data));
  await rename(tmp, DATA_FILE);
}

/** Zápisy se řadí do fronty → žádné souběžné přepsání souboru. */
function exclusive<R>(fn: (data: LocalData) => Promise<R> | R, write: boolean): Promise<R> {
  const run = state.queue.then(async () => {
    const data = await load();
    if (!write) return fn(data);
    const snapshot = JSON.stringify(data.tables);
    try {
      const result = await fn(data);
      await persist(data);
      return result;
    } catch (e) {
      data.tables = JSON.parse(snapshot); // vrácení změn (atomicita)
      throw e;
    }
  });
  state.queue = run.catch(() => undefined);
  return run;
}

export function readLocal<R>(fn: (data: LocalData) => R) {
  return exclusive(fn, false);
}
export function writeLocal<R>(fn: (data: LocalData) => R) {
  return exclusive(fn, true);
}

function rows<T extends TableName>(data: LocalData, table: T): Tables[T][] {
  return ((data.tables[table] ??= []) as Tables[T][]);
}

function matches(row: Record<string, unknown>, filter: Record<string, unknown> | undefined) {
  if (!filter) return true;
  return Object.entries(filter).every(([k, v]) => v === undefined || row[k] === v);
}

function memberHouseholds(data: LocalData, userId: string): Set<string> {
  return new Set(rows(data, "household_users").filter((u) => u.user_id === userId).map((u) => u.household_id));
}

function ownerHouseholds(data: LocalData, userId: string): Set<string> {
  return new Set(rows(data, "household_users").filter((u) => u.user_id === userId && u.role === "owner").map((u) => u.household_id));
}

/** Napodobení RLS. */
function canSee(data: LocalData, userId: string, table: TableName, row: Record<string, unknown>): boolean {
  const members = memberHouseholds(data, userId);
  if (table === "households") return members.has(row.id as string) || row.created_by === userId;
  if (table === "household_invites") return ownerHouseholds(data, userId).has(row.household_id as string);
  if (table === "push_subscriptions" || table === "subscriptions" || table === "ai_usage") return row.user_id === userId;
  if (table === "admin_audit") return false;
  return members.has(row.household_id as string);
}

/** Napodobení SQL funkcí user_is_premium / household_is_premium. */
export function localUserPremium(data: LocalData, userId: string): boolean {
  return subscriptionActive(rows(data, "subscriptions").find((s) => s.user_id === userId));
}
export function localHouseholdPremium(data: LocalData, hid: string): boolean {
  if (rows(data, "households").some((h) => h.id === hid && h.is_demo)) return true;
  return rows(data, "household_users").some((hu) => hu.household_id === hid && localUserPremium(data, hu.user_id));
}
const PREMIUM_TABLES = new Set<string>(["trips", "trip_legs", "trip_expenses", "trip_people", "trip_cash_moves", "trip_checklist", "trip_plan_items"]);

/** Napodobení triggerů s limity verze zdarma. */
function checkFreeLimits(data: LocalData, table: TableName, row: Record<string, unknown>) {
  if (table === "members") {
    const hid = row.household_id as string;
    if (!localHouseholdPremium(data, hid) && rows(data, "members").filter((m) => m.household_id === hid).length >= 2) {
      throw new DbError("forbidden", "Verze zdarma umožňuje nejvýše 2 členy domácnosti. Pro další členy aktivujte Premium.");
    }
  }
  if (table === "household_users" && row.role === "owner") {
    const uid = row.user_id as string;
    const isDemo = rows(data, "households").some((h) => h.id === row.household_id && h.is_demo);
    const owned = rows(data, "household_users").filter((hu) => hu.user_id === uid && hu.role === "owner" && !rows(data, "households").some((h) => h.id === hu.household_id && h.is_demo)).length;
    if (!isDemo && !localUserPremium(data, uid) && owned >= 1) throw new DbError("forbidden", "Verze zdarma umožňuje 1 vlastní domácnost. Pro další aktivujte Premium.");
  }
}

function canWrite(data: LocalData, userId: string, table: TableName, row: Record<string, unknown>, op: "insert" | "update" | "delete"): boolean {
  if (table === "households") {
    if (op === "insert") return row.created_by === userId;
    return ownerHouseholds(data, userId).has(row.id as string);
  }
  if (table === "household_users") {
    if (op === "insert") {
      const hh = rows(data, "households").find((h) => h.id === row.household_id);
      return row.user_id === userId && row.role === "owner" && hh?.created_by === userId;
    }
    if (op === "delete") return ownerHouseholds(data, userId).has(row.household_id as string) || row.user_id === userId;
    return ownerHouseholds(data, userId).has(row.household_id as string); // změna oprávnění jen vlastník
  }
  if (table === "household_invites") return ownerHouseholds(data, userId).has(row.household_id as string);
  if (table === "push_subscriptions") return row.user_id === userId && memberHouseholds(data, userId).has(row.household_id as string) && (op === "delete" || localHouseholdPremium(data, row.household_id as string));
  if (table === "subscriptions" || table === "admin_audit" || table === "ai_usage") return false; // zapisuje jen server
  const hid = row.household_id as string;
  if (!memberHouseholds(data, userId).has(hid)) return false;
  if (PREMIUM_TABLES.has(table) && op !== "delete" && !localHouseholdPremium(data, hid)) return false;
  const section = TABLE_SECTION[table];
  return section ? hasPerm(data, userId, hid, section) : true;
}

const SECTIONS = ["finance", "invoices", "work", "purchases", "savings", "settings", "travel"];

/** Napodobení has_household_perm / has_any_household_edit z SQL. */
function hasPerm(data: LocalData, userId: string, hid: string, section: string): boolean {
  const hu = rows(data, "household_users").find((u) => u.household_id === hid && u.user_id === userId);
  if (!hu) return false;
  if (hu.role === "owner") return true;
  const perms = (hu.permissions ?? {}) as Record<string, string>;
  if (section === "*") return SECTIONS.some((s) => (perms[s] ?? "edit") === "edit");
  return (perms[section] ?? "edit") === "edit";
}

function ensureMember(data: LocalData, userId: string, hid: string, memberName?: string | null): string {
  const members = rows(data, "members").filter((m) => m.household_id === hid);
  const own = members.find((m) => m.user_id === userId);
  if (own) return own.id;
  checkFreeLimits(data, "members", { household_id: hid });
  const colors = ["#d4b483", "#9ccc65", "#7fb3d5", "#f48fb1", "#ffab91", "#ce93d8"];
  const email = data.users.find((u) => u.id === userId)?.email ?? "";
  const id = randomUUID();
  rows(data, "members").push({
    id, household_id: hid, name: (memberName?.trim() || email.split("@")[0] || "Nový člen").slice(0, 80), color: colors[members.length % 6],
    user_id: userId, is_active: true, sort: members.length, phone: null, avatar_document_id: null, created_at: new Date().toISOString(),
  });
  return id;
}

function checkUnique(data: LocalData, table: TableName, row: Record<string, unknown>, ignoreId?: string) {
  for (const c of UNIQUE[table] ?? []) {
    if (c.where && !c.where(row)) continue;
    const clash = rows(data, table).some((other) => {
      const o = other as unknown as Record<string, unknown>;
      if (o.id === ignoreId || o.id === row.id) return false;
      if (c.where && !c.where(o)) return false;
      return c.columns.every((col) => (o[col] ?? null) === (row[col] ?? null));
    });
    if (clash) throw new DbError("unique", c.message);
  }
}

function checkRefs(data: LocalData, table: TableName, row: Record<string, unknown>) {
  for (const ref of REFS[table] ?? []) {
    const v = row[ref.column];
    if (v == null) continue;
    const target = rows(data, ref.table).find((r) => (r as unknown as Record<string, unknown>).id === v) as unknown as Record<string, unknown> | undefined;
    if (!target || target.household_id !== row.household_id) {
      throw new DbError("reference", `Odkaz ${ref.column} neukazuje na záznam této domácnosti.`);
    }
  }
}

function cascadeDelete(data: LocalData, table: TableName, id: string) {
  for (const [child, refs] of Object.entries(REFS) as [TableName, NonNullable<(typeof REFS)[TableName]>][]) {
    for (const ref of refs) {
      if (ref.table !== table) continue;
      const list = rows(data, child) as unknown as Record<string, unknown>[];
      const affected = list.filter((r) => r[ref.column] === id);
      if (!affected.length) continue;
      if (ref.onDelete === "restrict") throw new DbError("reference", "Záznam nelze smazat, protože na něj odkazují jiná data (např. transakce). Můžete ho archivovat.");
      if (ref.onDelete === "set_null") for (const r of affected) r[ref.column] = null;
      if (ref.onDelete === "cascade") {
        for (const r of affected) cascadeDelete(data, child, r.id as string);
        data.tables[child] = list.filter((r) => r[ref.column] !== id) as never;
      }
    }
  }
}

function deleteHouseholdData(data: LocalData, householdId: string) {
  for (const t of Object.keys(data.tables) as TableName[]) {
    if (t === "households") continue;
    data.tables[t] = (rows(data, t) as unknown as Record<string, unknown>[]).filter((r) => r.household_id !== householdId) as never;
  }
}

function localFiles(): FileStore {
  const safe = (p: string) => {
    const full = path.resolve(FILES_DIR, p);
    if (!full.startsWith(FILES_DIR + path.sep)) throw new DbError("forbidden", "Neplatná cesta k souboru.");
    return full;
  };
  return {
    async upload(p, bytes, mime) {
      const full = safe(p);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, bytes);
      await writeFile(full + ".mime", mime);
    },
    async download(p) {
      try {
        const full = safe(p);
        const [bytes, mime] = await Promise.all([readFile(full), readFile(full + ".mime", "utf8").catch(() => "application/octet-stream")]);
        return { bytes: new Uint8Array(bytes), mime };
      } catch {
        return null;
      }
    },
    async remove(p) {
      const full = safe(p);
      await rm(full, { force: true });
      await rm(full + ".mime", { force: true });
    },
  };
}

export function createLocalStore(userId: string): Store {
  const now = () => new Date().toISOString();
  return {
    mode: "local",
    select<T extends TableName>(table: T, filter?: Filter<T>) {
      return readLocal((data) =>
        rows(data, table)
          .filter((r) => canSee(data, userId, table, r as unknown as Record<string, unknown>))
          .filter((r) => matches(r as unknown as Record<string, unknown>, filter as Record<string, unknown>))
          .map((r) => ({ ...r })),
      );
    },
    insert<T extends TableName>(table: T, newRows: NewRow<T>[]) {
      return writeLocal((data) => {
        const out: Row<T>[] = [];
        for (const nr of newRows) {
          const row = { id: randomUUID(), created_at: now(), ...nr } as unknown as Record<string, unknown>;
          if (TABLES_WITH_UPDATED_AT.includes(table)) row.updated_at = now();
          if (table === "households" && !row.created_by) row.created_by = userId;
          if (!canWrite(data, userId, table, row, "insert")) throw new DbError("forbidden", "Nemáte oprávnění k této úpravě. Oprávnění nastavuje vlastník domácnosti.");
          checkFreeLimits(data, table, row);
          if (rows(data, table).some((r) => (r as unknown as Record<string, unknown>).id === row.id)) throw new DbError("unique", "Záznam už existuje.");
          checkUnique(data, table, row);
          checkRefs(data, table, row);
          rows(data, table).push(row as unknown as Tables[T]);
          out.push({ ...(row as unknown as Row<T>) });
        }
        return out;
      });
    },
    update<T extends TableName>(table: T, filter: Filter<T>, patch: NewRow<T>) {
      return writeLocal((data) => {
        const list = rows(data, table) as unknown as Record<string, unknown>[];
        const targets = list.filter((r) => canSee(data, userId, table, r) && matches(r, filter as Record<string, unknown>));
        const out: Row<T>[] = [];
        for (const r of targets) {
          const next = { ...r, ...patch, id: r.id, household_id: r.household_id } as Record<string, unknown>;
          if (TABLES_WITH_UPDATED_AT.includes(table)) next.updated_at = now();
          if (!canWrite(data, userId, table, next, "update")) throw new DbError("forbidden", "Nemáte oprávnění k této úpravě. Oprávnění nastavuje vlastník domácnosti.");
          checkUnique(data, table, next, r.id as string);
          checkRefs(data, table, next);
          Object.assign(r, next);
          out.push({ ...(r as unknown as Row<T>) });
        }
        return out;
      });
    },
    remove<T extends TableName>(table: T, filter: Filter<T>) {
      return writeLocal((data) => {
        const list = rows(data, table) as unknown as Record<string, unknown>[];
        const targets = list.filter((r) => canSee(data, userId, table, r) && matches(r, filter as Record<string, unknown>));
        for (const r of targets) {
          if (!canWrite(data, userId, table, r, "delete")) throw new DbError("forbidden", "Nemáte oprávnění k této úpravě. Oprávnění nastavuje vlastník domácnosti.");
          if (table === "households") deleteHouseholdData(data, r.id as string);
          else cascadeDelete(data, table, r.id as string);
        }
        const ids = new Set(targets.map((t) => t.id));
        data.tables[table] = list.filter((r) => !ids.has(r.id)) as never;
        return targets.length;
      });
    },
    householdPremium(householdId: string) {
      return readLocal((data) => localHouseholdPremium(data, householdId));
    },
    userPremium() {
      return readLocal((data) => localUserPremium(data, userId));
    },
    bumpAiUsage() {
      return writeLocal((data) => {
        const month = new Date().toISOString().slice(0, 7);
        const list = rows(data, "ai_usage");
        const row = list.find((r) => r.user_id === userId && r.month === month);
        if (row) row.count += 1;
        else list.push({ user_id: userId, month, count: 1 });
        return row?.count ?? 1;
      });
    },
    acceptInvite(code: string, memberName?: string | null) {
      return writeLocal((data) => {
        const inv = rows(data, "household_invites").find((i) => i.code.toUpperCase() === code.toUpperCase() && !i.used_by && i.expires_at > now());
        if (!inv) throw new DbError("not_found", "Pozvánka neexistuje nebo vypršela.");
        if (!rows(data, "members").some((m) => m.household_id === inv.household_id && m.user_id === userId)) checkFreeLimits(data, "members", { household_id: inv.household_id });
        if (!memberHouseholds(data, userId).has(inv.household_id)) {
          rows(data, "household_users").push({ id: randomUUID(), household_id: inv.household_id, user_id: userId, role: "member", permissions: {}, created_at: now() });
        }
        inv.used_by = userId;
        ensureMember(data, userId, inv.household_id, memberName);
        return inv.household_id;
      });
    },
    ensureOwnMember(householdId: string, memberName?: string | null) {
      return writeLocal((data) => {
        if (!memberHouseholds(data, userId).has(householdId)) throw new DbError("forbidden", "Nejste členem domácnosti.");
        return ensureMember(data, userId, householdId, memberName);
      });
    },
    files: localFiles(),
  };
}
