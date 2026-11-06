"use server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { HOUSEHOLD_COOKIE, requireContext, requireUser } from "@/lib/context";
import { createHousehold } from "@/lib/household-setup";
import { MEMBER_COLORS } from "@/lib/defaults";
import { todayISO } from "@/lib/dates";
import { date, enumOf, ico, int, money, optionalMoney, text, optText } from "@/lib/validation";
import { done, errorToResult, fail, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";

async function setHouseholdCookie(id: string) {
  (await cookies()).set(HOUSEHOLD_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 86_400 });
}

const onboardingSchema = z.object({
  householdName: text(120),
  members: z.array(z.object({ name: text(80) })).min(1, "Přidejte alespoň jednoho člena"),
  accounts: z.array(z.object({ name: text(80), kind: enumOf(["checking", "cash", "savings"]), balance: money({ allowNegative: true }), date: date() })),
  incomes: z.array(z.object({ name: text(120), amount: money({ min: 1 }), frequency: enumOf(["weekly", "monthly", "quarterly", "yearly", "once"]), date: date(), member: int(0, 20) })),
  recurring: z.array(z.object({ name: text(120), amount: money({ min: 1 }), frequency: enumOf(["weekly", "monthly", "quarterly", "yearly", "once"]), date: date(), category: z.string().max(60).optional() })),
  foodBudget: optionalMoney(),
  safetyBuffer: optionalMoney(),
  billingIco: ico(),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;

/** Dokončení úvodního nastavení – vše zadává uživatel, nic se nevymýšlí. */
export async function completeOnboarding(json: string): Promise<ActionResult> {
  let householdId: string;
  try {
    const { user, store } = await requireUser();
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return fail("Neplatná data formuláře.");
    }
    const p = parse(onboardingSchema, raw as Record<string, unknown>);
    if (!p.ok) return p.result;
    const d = p.data;
    const hh = await createHousehold(store, user, d.householdName);
    householdId = hh.id;
    const hid = hh.id;
    const members = await store.insert("members", d.members.map((m, i) => ({
      household_id: hid, name: m.name, color: MEMBER_COLORS[i % MEMBER_COLORS.length], user_id: i === 0 ? user.id : null, is_active: true, sort: i,
    })));
    const accounts = d.accounts.length
      ? await store.insert("accounts", d.accounts.map((a, i) => ({
          household_id: hid, name: a.name, kind: a.kind, opening_balance: a.balance, opening_date: a.date,
          include_in_available: a.kind !== "savings", member_id: null, is_active: true, sort: i,
        })))
      : [];
    const defaultAccount = accounts.find((a) => a.include_in_available) ?? null;
    const categories = await store.select("categories", { household_id: hid });
    const incomeCat = categories.find((c) => c.kind === "income" && c.name.startsWith("Mzda"));
    if (d.incomes.length) {
      await store.insert("income_sources", d.incomes.map((i) => ({
        household_id: hid, name: i.name, amount: i.amount, frequency: i.frequency, start_date: i.date, end_date: null,
        member_id: members[i.member]?.id ?? null, account_id: defaultAccount?.id ?? null, category_id: incomeCat?.id ?? null, is_active: true, note: null,
      })));
    }
    if (d.recurring.length) {
      await store.insert("recurring_payments", d.recurring.map((r) => ({
        household_id: hid, name: r.name, amount: r.amount, frequency: r.frequency, start_date: r.date, end_date: null,
        category_id: categories.find((c) => c.kind === "expense" && c.name === r.category)?.id ?? null,
        account_id: defaultAccount?.id ?? null, member_id: null, payment_method: "transfer", is_debt: false, debt_remaining: null, is_active: true, note: null,
      })));
    }
    if (d.foodBudget != null) await store.insert("budgets", [{ household_id: hid, kind: "food", category_id: null, amount: d.foodBudget, month: null }]);
    await store.update("household_settings", { household_id: hid }, {
      safety_buffer: d.safetyBuffer ?? 0, billing_ico: d.billingIco, onboarded_at: new Date().toISOString(),
    });
    await setHouseholdCookie(hid);
  } catch (e) {
    return errorToResult(e);
  }
  revalidatePath("/", "layout");
  redirect(`/?vitejte=${householdId}`);
}

export async function switchHousehold(id: string) {
  const ctx = await requireContext();
  if (!ctx.households.some((h) => h.id === id)) return;
  await setHouseholdCookie(id);
  revalidatePath("/", "layout");
  redirect("/");
}

/** Demo domácnost je ODDĚLENÁ od skutečných financí (samostatná domácnost s příznakem is_demo). */
export async function createDemoHousehold(): Promise<ActionResult> {
  let id: string;
  try {
    const { user, store } = await requireUser();
    const { seedDemo } = await import("@/lib/demo");
    const hh = await createHousehold(store, user, "Ukázková domácnost (DEMO)", true);
    id = hh.id;
    await seedDemo(store, user, hh.id, todayISO());
    await setHouseholdCookie(hh.id);
  } catch (e) {
    return errorToResult(e);
  }
  revalidatePath("/", "layout");
  redirect("/");
  return { ok: true, id };
}

export async function deleteHousehold(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const id = String(fd.get("id") ?? "");
    const hh = ctx.households.find((h) => h.id === id);
    if (!hh) return fail("Domácnost nenalezena.");
    if (ctx.role !== "owner" && hh.id === ctx.household.id) return fail("Smazat domácnost může jen vlastník.");
    if (!hh.is_demo && String(fd.get("confirm") ?? "").trim() !== hh.name) return fail("Pro potvrzení opište přesný název domácnosti.", { confirm: "Název nesouhlasí" });
    const docs = await ctx.store.select("documents", { household_id: id });
    for (const d of docs) await ctx.store.files.remove(d.storage_path).catch(() => undefined);
    await ctx.store.remove("households", { id });
    (await cookies()).delete(HOUSEHOLD_COOKIE);
    return done(hh.is_demo ? "Demo domácnost byla smazána." : "Domácnost byla smazána.");
  });
}

export async function renameHousehold(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(z.object({ name: text(120) }), fd);
    if (!p.ok) return p.result;
    await ctx.store.update("households", { id: ctx.household.id }, { name: p.data.name });
    return done("Uloženo");
  });
}

const settingsFields = {
  safety_buffer: money(),
  food_warn_percent: int(1, 100),
  pace_tolerance_percent: int(0, 100),
  notify_due_days: int(0, 60),
  notify_food: z.boolean(),
  notify_invoices: z.boolean(),
  notify_payments: z.boolean(),
  billing_name: optText(200),
  billing_ico: ico(),
  billing_dic: optText(20),
  billing_address: optText(300),
  billing_bank_account: optText(60),
  invoice_number_prefix: optText(20),
} as const;

/** Automatické ukládání jednoho pole nastavení. */
export async function saveSetting(field: string, value: string | boolean): Promise<ActionResult> {
  return withContext(async (ctx) => {
    if (!(field in settingsFields)) return fail("Neznámé pole.");
    const schema = settingsFields[field as keyof typeof settingsFields];
    const r = (schema as z.ZodType).safeParse(value);
    if (!r.success) return fail(r.error.issues[0]?.message ?? "Neplatná hodnota");
    await ctx.store.update("household_settings", { household_id: ctx.household.id }, { [field]: r.data });
    return done("Uloženo");
  });
}

export async function createInvite(): Promise<ActionResult> {
  return withContext(async (ctx) => {
    if (ctx.role !== "owner") return fail("Pozvánky vytváří vlastník domácnosti.");
    const code = randomBytes(9).toString("base64url").toUpperCase();
    await ctx.store.insert("household_invites", [{
      household_id: ctx.household.id, code, created_by: ctx.user.id, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), used_by: null,
    }]);
    return done(code);
  });
}

export async function acceptInvite(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const { user, store } = await requireUser();
    const code = String(fd.get("code") ?? "").trim().toUpperCase();
    if (code.length < 10) return fail("Zadejte kód pozvánky.", { code: "Neplatný kód" });
    id = await store.acceptInvite(code);
    // připojený uživatel se automaticky objeví mezi členy domácnosti (vidí ho i vlastník)
    const members = await store.select("members", { household_id: id });
    if (!members.some((m) => m.user_id === user.id)) {
      const name = String(fd.get("member_name") ?? "").trim().slice(0, 80) || user.email.split("@")[0] || "Nový člen";
      await store.insert("members", [{
        household_id: id, name, color: MEMBER_COLORS[members.length % MEMBER_COLORS.length], user_id: user.id, is_active: true, sort: members.length,
      }]);
    }
    await setHouseholdCookie(id);
  } catch (e) {
    return errorToResult(e);
  }
  revalidatePath("/", "layout");
  redirect("/");
}
