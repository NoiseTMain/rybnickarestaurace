import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DbError, type Filter, type NewRow, type Row, type Store } from "./store";
import { MONEY_COLUMNS, type Subscription, type TableName } from "./types";
import { PRIMARY_KEY } from "./schema-meta";
import { subscriptionActive } from "@/lib/subscription";

const PAGE = 1000;

function normalize<T extends TableName>(table: T, row: Record<string, unknown>): Row<T> {
  for (const col of MONEY_COLUMNS[table] ?? []) {
    if (row[col] != null) row[col] = Number(row[col]);
  }
  if (table === "work_shifts" && row.private_km != null) row.private_km = String(row.private_km);
  return row as unknown as Row<T>;
}

function mapError(e: { code?: string; message?: string } | null): DbError {
  const code = e?.code ?? "";
  const premium = e?.message?.match(/PREMIUM:\s*(.+)$/);
  if (premium) return new DbError("forbidden", premium[1]);
  if (code === "23505") return new DbError("unique", "Záznam už existuje (duplicitní údaj).");
  if (code === "23503") return new DbError("reference", "Záznam nelze uložit nebo smazat kvůli vazbě na jiná data (např. účet s transakcemi).");
  if (code === "23514" || code === "23502" || code === "22P02") return new DbError("check", "Údaje nesplňují pravidla databáze.");
  if (code === "42501") return new DbError("forbidden", "Nemáte oprávnění k této úpravě. Oprávnění nastavuje vlastník domácnosti.");
  if (code === "23514" && e?.message?.includes("IČO")) return new DbError("check", "IČO lze měnit nejvýše jednou za 30 dní.");
  return new DbError("unknown", e?.message ?? "Chyba databáze.");
}

export function createSupabaseStore(client: SupabaseClient): Store {
  return {
    mode: "supabase",
    async select<T extends TableName>(table: T, filter?: Filter<T>) {
      const page = (from: number, count = false) => {
        let q = client.from(table).select("*", count ? { count: "exact" } : undefined);
        for (const [k, v] of Object.entries(filter ?? {})) {
          if (v === undefined) continue;
          q = v === null ? q.is(k, null) : q.eq(k, v as string);
        }
        return q.order(PRIMARY_KEY[table] ?? "id").range(from, from + PAGE - 1);
      };
      // první stránka zjistí počet; zbylé stránky se načtou souběžně (rychlé i pro tisíce záznamů)
      const first = await page(0, true);
      if (first.error) throw mapError(first.error);
      const out: Row<T>[] = (first.data ?? []).map((r) => normalize(table, r));
      const total = first.count ?? out.length;
      if (total > PAGE) {
        const rest = await Promise.all(Array.from({ length: Math.ceil(total / PAGE) - 1 }, (_, i) => page((i + 1) * PAGE)));
        for (const r of rest) {
          if (r.error) throw mapError(r.error);
          out.push(...(r.data ?? []).map((x) => normalize(table, x)));
        }
      }
      return out;
    },
    async insert<T extends TableName>(table: T, rows: NewRow<T>[]) {
      if (!rows.length) return [];
      const out: Row<T>[] = [];
      for (let i = 0; i < rows.length; i += 500) {
        const { data, error } = await client.from(table).insert(rows.slice(i, i + 500) as never).select("*");
        if (error) throw mapError(error);
        out.push(...(data ?? []).map((r) => normalize(table, r)));
      }
      return out;
    },
    async update<T extends TableName>(table: T, filter: Filter<T>, patch: NewRow<T>) {
      let q = client.from(table).update(patch as never);
      for (const [k, v] of Object.entries(filter)) {
        if (v === undefined) continue;
        q = v === null ? q.is(k, null) : q.eq(k, v as string);
      }
      const { data, error } = await q.select("*");
      if (error) throw mapError(error);
      return (data ?? []).map((r) => normalize(table, r));
    },
    async remove<T extends TableName>(table: T, filter: Filter<T>) {
      let q = client.from(table).delete({ count: "exact" });
      for (const [k, v] of Object.entries(filter)) {
        if (v === undefined) continue;
        q = v === null ? q.is(k, null) : q.eq(k, v as string);
      }
      const { error, count } = await q;
      if (error) throw mapError(error);
      return count ?? 0;
    },
    async acceptInvite(code: string, memberName?: string | null) {
      const { data, error } = await client.rpc("accept_household_invite", { invite_code: code, member_name: memberName ?? null });
      if (error) throw error.message?.includes("PREMIUM:") ? mapError(error) : new DbError("not_found", "Pozvánka neexistuje nebo vypršela.");
      return data as string;
    },
    async ensureOwnMember(householdId: string, memberName?: string | null) {
      const { data, error } = await client.rpc("ensure_own_member", { hid: householdId, member_name: memberName ?? null });
      if (error) throw mapError(error);
      return data as string;
    },
    async recipeLikeCounts() {
      const { data, error } = await client.rpc("recipe_like_counts");
      if (error || !data) return {};
      return Object.fromEntries((data as { recipe_id: string; likes: number }[]).map((r) => [r.recipe_id, Number(r.likes)]));
    },
    async householdPremium(householdId: string) {
      const { data, error } = await client.rpc("household_is_premium", { hid: householdId });
      if (error) return false;
      return Boolean(data);
    },
    async userPremium() {
      const { data } = await client.from("subscriptions").select("*").maybeSingle();
      return subscriptionActive(data as Subscription | null);
    },
    async bumpAiUsage() {
      const { data, error } = await client.rpc("increment_ai_usage");
      if (error) throw mapError(error);
      return Number(data);
    },
    files: {
      async upload(path, bytes, mime) {
        const { error } = await client.storage.from("documents").upload(path, bytes, { contentType: mime, upsert: false });
        if (error) throw new DbError("unknown", `Nahrání souboru selhalo: ${error.message}`);
      },
      async download(path) {
        const { data, error } = await client.storage.from("documents").download(path);
        if (error || !data) return null;
        return { bytes: new Uint8Array(await data.arrayBuffer()), mime: data.type || "application/octet-stream" };
      },
      async remove(path) {
        await client.storage.from("documents").remove([path]);
      },
    },
  };
}
