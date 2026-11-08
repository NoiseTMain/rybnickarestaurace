import "server-only";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { appMode, publicEnv } from "@/lib/env";
import type { AdminAudit, Subscription, Transaction, Trip, TripExpense, TripLeg, TripPerson, TripPlanItem, TripSettlement } from "@/lib/db/types";

/**
 * Serverový přístup napříč všemi uživateli – jen pro administraci, webhook plateb a plánované úlohy.
 * V Supabase používá service-role klíč (obchází RLS), proto se volá výhradně po ověření administrátora
 * nebo podpisu webhooku. Nikdy se neposílá do prohlížeče.
 */

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  banned: boolean;
}

export interface AdminHousehold {
  id: string;
  name: string;
  is_demo: boolean;
  created_at: string;
  owners: string[];
  users: string[];
  counts: { members: number; accounts: number; transactions: number; trips: number; documents: number };
  lastActivity: string | null;
}

export interface SharedTrip {
  trip: Trip;
  legs: TripLeg[];
  plan: TripPlanItem[];
  people: TripPerson[];
  expenses: TripExpense[];
  settlements: TripSettlement[];
  transactions: Pick<Transaction, "id" | "status" | "amount">[];
}

export interface AdminBackend {
  /** Cesta podle tokenu ze sdíleného odkazu (jen pro čtení). */
  sharedTrip(token: string): Promise<SharedTrip | null>;
  listUsers(): Promise<AdminUser[]>;
  findUserByEmail(email: string): Promise<AdminUser | null>;
  subscriptions(): Promise<Subscription[]>;
  upsertSubscription(row: Partial<Subscription> & { user_id: string }): Promise<void>;
  subscriptionByProviderId(id: string): Promise<Subscription | null>;
  households(): Promise<AdminHousehold[]>;
  audit(row: Omit<AdminAudit, "id" | "created_at">): Promise<void>;
  auditLog(limit?: number): Promise<AdminAudit[]>;
  aiUsage(month: string): Promise<{ user_id: string; count: number }[]>;
  setBanned(userId: string, banned: boolean): Promise<void>;
  /** Zkušební období: bylo už pro tento e-mail (hash) využito? */
  trialClaimed(emailHash: string): Promise<boolean>;
  claimTrial(emailHash: string, userId: string, card: string | null): Promise<void>;
  /** Byla už stejná karta použita na zkušební období u jiného účtu? */
  trialCardUsed(card: string, userId: string): Promise<boolean>;
  /** Smaže účet: domácnosti, kde byl jediný, smaže; jinde předá vlastnictví dalšímu členovi. */
  deleteUser(userId: string): Promise<void>;
}

export function adminConfigured(): boolean {
  return appMode() === "local" || Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const ADMINS = () => (process.env.ADMIN_EMAILS ?? "adamhorvath07@icloud.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && ADMINS().includes(email!.toLowerCase());
}

export async function adminBackend(): Promise<AdminBackend> {
  return appMode() === "local" ? localBackend() : supabaseBackend();
}

function supabaseBackend(): AdminBackend {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Chybí SUPABASE_SERVICE_ROLE_KEY – administrace a platby potřebují serverový klíč.");
  const db = createClient(publicEnv.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const toUser = (u: { id: string; email?: string; created_at: string; last_sign_in_at?: string | null; email_confirmed_at?: string | null; banned_until?: string | null }): AdminUser => ({
    id: u.id, email: u.email ?? "", created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null, confirmed: Boolean(u.email_confirmed_at),
    banned: Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
  });
  const all = async <T>(table: string, columns = "*"): Promise<T[]> => {
    const out: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table).select(columns).range(from, from + 999);
      if (error) throw new Error(error.message);
      out.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) break;
    }
    return out;
  };
  return {
    async sharedTrip(token) {
      if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
      const { data: trip } = await db.from("trips").select("*").eq("share_token", token).maybeSingle();
      if (!trip) return null;
      const q = async <T>(table: string) => ((await db.from(table).select("*").eq("trip_id", trip.id)).data ?? []) as T[];
      const [legs, plan, people, expenses, settlements] = await Promise.all([q<TripLeg>("trip_legs"), q<TripPlanItem>("trip_plan_items"), q<TripPerson>("trip_people"), q<TripExpense>("trip_expenses"), q<TripSettlement>("trip_settlements")]);
      const ids = expenses.map((e) => e.transaction_id).filter((x): x is string => Boolean(x));
      const txs = ids.length ? ((await db.from("transactions").select("id,status,amount").in("id", ids)).data ?? []) : [];
      const num = <T extends object>(rows: T[], cols: string[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, cols.includes(k) && v != null ? Number(v) : v])) as T);
      return {
        trip: num([trip as Trip], ["budget"])[0], legs: num(legs, ["price"]).sort((a, b) => a.sort - b.sort), plan, people: people.sort((a, b) => a.sort - b.sort),
        expenses: num(expenses, ["amount", "amount_original", "rate"]), settlements: num(settlements, ["amount"]), transactions: num(txs as Transaction[], ["amount"]),
      };
    },
    async listUsers() {
      const users: AdminUser[] = [];
      for (let page = 1; page < 100; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw new Error(error.message);
        users.push(...data.users.map(toUser));
        if (data.users.length < 1000) break;
      }
      return users;
    },
    async findUserByEmail(email) {
      return (await this.listUsers()).find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
    },
    subscriptions: () => all<Subscription>("subscriptions"),
    async upsertSubscription(row) {
      const { error } = await db.from("subscriptions").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
    },
    async subscriptionByProviderId(id) {
      const { data } = await db.from("subscriptions").select("*").eq("provider_subscription_id", id).maybeSingle();
      return (data as Subscription | null) ?? null;
    },
    async households() {
      const [hh, hu, members, accounts, txs, trips, docs] = await Promise.all([
        all<{ id: string; name: string; is_demo: boolean; created_at: string }>("households", "id,name,is_demo,created_at"),
        all<{ household_id: string; user_id: string; role: string }>("household_users", "household_id,user_id,role"),
        all<{ household_id: string }>("members", "household_id"),
        all<{ household_id: string }>("accounts", "household_id"),
        all<{ household_id: string; created_at: string }>("transactions", "household_id,created_at"),
        all<{ household_id: string }>("trips", "household_id"),
        all<{ household_id: string }>("documents", "household_id"),
      ]);
      return summarize(hh, hu, members, accounts, txs, trips, docs);
    },
    async audit(row) {
      await db.from("admin_audit").insert(row);
    },
    async auditLog(limit = 100) {
      const { data } = await db.from("admin_audit").select("*").order("created_at", { ascending: false }).limit(limit);
      return (data ?? []) as AdminAudit[];
    },
    async aiUsage(month) {
      const { data } = await db.from("ai_usage").select("user_id,count").eq("month", month);
      return (data ?? []) as { user_id: string; count: number }[];
    },
    async trialClaimed(hash) {
      const { data } = await db.from("trial_claims").select("email_hash").eq("email_hash", hash).maybeSingle();
      return Boolean(data);
    },
    async claimTrial(hash, userId, card) {
      await db.from("trial_claims").upsert({ email_hash: hash, user_id: userId, card }, { onConflict: "email_hash", ignoreDuplicates: true });
    },
    async trialCardUsed(card, userId) {
      const { data } = await db.from("trial_claims").select("user_id").eq("card", card).neq("user_id", userId).limit(1);
      return Boolean(data?.length);
    },
    async setBanned(userId, banned) {
      const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: banned ? "876000h" : "none" });
      if (error) throw new Error(error.message);
    },
    async deleteUser(userId) {
      const { data: mine } = await db.from("household_users").select("household_id,role").eq("user_id", userId);
      for (const m of mine ?? []) {
        const { data: others } = await db.from("household_users").select("user_id,role").eq("household_id", m.household_id).neq("user_id", userId);
        if (!others?.length) {
          const { data: docs } = await db.from("documents").select("storage_path").eq("household_id", m.household_id);
          if (docs?.length) await db.storage.from("documents").remove(docs.map((d) => d.storage_path as string));
          await db.from("households").delete().eq("id", m.household_id);
        } else if (m.role === "owner" && !others.some((o) => o.role === "owner")) {
          await db.from("household_users").update({ role: "owner" }).eq("household_id", m.household_id).eq("user_id", others[0].user_id);
        }
      }
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    },
  };
}

function summarize(
  hh: { id: string; name: string; is_demo: boolean; created_at: string }[], hu: { household_id: string; user_id: string; role: string }[],
  members: { household_id: string }[], accounts: { household_id: string }[], txs: { household_id: string; created_at: string }[],
  trips: { household_id: string }[], docs: { household_id: string }[],
): AdminHousehold[] {
  const count = (list: { household_id: string }[]) => {
    const m = new Map<string, number>();
    for (const r of list) m.set(r.household_id, (m.get(r.household_id) ?? 0) + 1);
    return m;
  };
  const [cm, ca, ct, ctr, cd] = [count(members), count(accounts), count(txs), count(trips), count(docs)];
  const last = new Map<string, string>();
  for (const t of txs) if ((last.get(t.household_id) ?? "") < t.created_at) last.set(t.household_id, t.created_at);
  return hh.map((h) => ({
    id: h.id, name: h.name, is_demo: h.is_demo, created_at: h.created_at,
    owners: hu.filter((x) => x.household_id === h.id && x.role === "owner").map((x) => x.user_id),
    users: hu.filter((x) => x.household_id === h.id).map((x) => x.user_id),
    counts: { members: cm.get(h.id) ?? 0, accounts: ca.get(h.id) ?? 0, transactions: ct.get(h.id) ?? 0, trips: ctr.get(h.id) ?? 0, documents: cd.get(h.id) ?? 0 },
    lastActivity: last.get(h.id) ?? null,
  }));
}

async function localBackend(): Promise<AdminBackend> {
  const { readLocal, writeLocal } = await import("@/lib/db/local-store");
  type Any = Record<string, unknown>;
  const t = (d: { tables: Record<string, unknown[] | undefined> }, name: string) => ((d.tables[name] ??= []) as Any[]);
  const backend: AdminBackend = {
    sharedTrip: (token) => readLocal((d) => {
      const trip = t(d as never, "trips").find((x) => x.share_token === token) as unknown as Trip | undefined;
      if (!trip || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
      const of = <T>(n: string) => t(d as never, n).filter((r) => r.trip_id === trip.id).map((r) => ({ ...r })) as unknown as T[];
      const expenses = of<TripExpense>("trip_expenses");
      const ids = new Set(expenses.map((e) => e.transaction_id));
      return {
        trip: { ...trip }, legs: of<TripLeg>("trip_legs").sort((a, b) => a.sort - b.sort), plan: of<TripPlanItem>("trip_plan_items"), people: of<TripPerson>("trip_people"), expenses,
        settlements: of<TripSettlement>("trip_settlements"),
        transactions: t(d as never, "transactions").filter((x) => ids.has(x.id as string)).map((x) => ({ id: x.id, status: x.status, amount: x.amount })) as never,
      };
    }),
    listUsers: () => readLocal((d) => d.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: (u as unknown as Any).last_sign_in_at as string ?? null, confirmed: true, banned: Boolean((u as unknown as Any).banned) }))),
    async findUserByEmail(email) {
      return (await backend.listUsers()).find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
    },
    subscriptions: () => readLocal((d) => t(d as never, "subscriptions").map((r) => ({ ...r })) as unknown as Subscription[]),
    upsertSubscription: (row) => writeLocal((d) => {
      const list = t(d as never, "subscriptions");
      const i = list.findIndex((r) => r.user_id === row.user_id);
      const now = new Date().toISOString();
      if (i >= 0) list[i] = { ...list[i], ...row, updated_at: now };
      else list.push({ status: "granted", source: "admin", variant: null, provider_subscription_id: null, provider_customer_id: null, renews_at: null, ends_at: null, portal_url: null, granted_by: null, note: null, created_at: now, ...row, updated_at: now });
    }),
    subscriptionByProviderId: (id) => readLocal((d) => (t(d as never, "subscriptions").find((r) => r.provider_subscription_id === id) as unknown as Subscription) ?? null),
    households: () => readLocal((d) => {
      const g = (n: string) => t(d as never, n) as never[];
      return summarize(g("households"), g("household_users"), g("members"), g("accounts"), g("transactions"), g("trips"), g("documents"));
    }),
    audit: (row) => writeLocal((d) => { t(d as never, "admin_audit").push({ id: randomUUID(), created_at: new Date().toISOString(), ...row }); }),
    auditLog: (limit = 100) => readLocal((d) => [...t(d as never, "admin_audit")].reverse().slice(0, limit) as unknown as AdminAudit[]),
    aiUsage: (month) => readLocal((d) => t(d as never, "ai_usage").filter((r) => r.month === month).map((r) => ({ user_id: r.user_id as string, count: r.count as number }))),
    trialClaimed: (hash) => readLocal((d) => t(d as never, "trial_claims").some((r) => r.email_hash === hash)),
    claimTrial: (hash, userId, card) => writeLocal((d) => { const l = t(d as never, "trial_claims"); if (!l.some((r) => r.email_hash === hash)) l.push({ email_hash: hash, user_id: userId, card, created_at: new Date().toISOString() }); }),
    trialCardUsed: (card, userId) => readLocal((d) => t(d as never, "trial_claims").some((r) => r.card === card && r.user_id !== userId)),
    setBanned: (userId, banned) => writeLocal((d) => { const u = d.users.find((x) => x.id === userId) as unknown as Any | undefined; if (u) u.banned = banned; }),
    deleteUser: (userId) => writeLocal((d) => {
      d.users = d.users.filter((u) => u.id !== userId);
      for (const name of ["subscriptions", "ai_usage", "push_subscriptions"]) (d.tables as Any)[name] = t(d as never, name).filter((r) => r.user_id !== userId);
      const owned = t(d as never, "household_users").filter((r) => r.user_id === userId).map((r) => r.household_id as string);
      (d.tables as Any).household_users = t(d as never, "household_users").filter((r) => r.user_id !== userId);
      for (const hid of owned) {
        const rest = t(d as never, "household_users").filter((r) => r.household_id === hid);
        if (rest.length) {
          if (!rest.some((r) => r.role === "owner")) rest[0].role = "owner"; // vlastnictví přejde na dalšího člena
          for (const h of t(d as never, "households").filter((x) => x.id === hid && x.created_by === userId)) h.created_by = null;
          continue;
        }
        for (const name of Object.keys(d.tables)) (d.tables as Any)[name] = t(d as never, name).filter((r) => r.household_id !== hid && !(name === "households" && r.id === hid));
      }
    }),
  };
  return backend;
}
