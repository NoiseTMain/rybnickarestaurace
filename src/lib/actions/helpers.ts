import "server-only";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireContext, type AppContext } from "@/lib/context";
import { DbError } from "@/lib/db/store";
import { formToObject } from "@/lib/validation";
import type { ActionResult } from "./result";

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult {
  return { ok: false, error, fieldErrors, at: Date.now() };
}

export function done(message: string, id?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message, id, at: Date.now() };
}

export function errorToResult(e: unknown): ActionResult {
  if (e instanceof DbError) return fail(e.message);
  // přesměrování z requireContext apod. musí projít dál
  if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
  console.error(e);
  void import("@/lib/errors-log").then((m) => m.logAppError({ message: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : null, path: "server-action" }));
  return fail(e instanceof Error && e.message ? `Uložení se nepovedlo: ${e.message}` : "Uložení se nepovedlo.");
}

export function parse<S extends z.ZodType>(schema: S, fd: FormData | Record<string, unknown>):
  | { ok: true; data: z.infer<S> }
  | { ok: false; result: ActionResult } {
  const obj = fd instanceof FormData ? formToObject(fd) : fd;
  const r = schema.safeParse(obj);
  if (r.success) return { ok: true, data: r.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, result: fail("Zkontrolujte zvýrazněná pole.", fieldErrors) };
}

/** Obal serverové akce: přihlášení, domácnost, chyby. */
export async function withContext(fn: (ctx: AppContext) => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    return await fn(ctx);
  } catch (e) {
    return errorToResult(e);
  }
}

/** Ověří, že záznam patří do aktuální domácnosti (v Supabase to zajišťuje i RLS). */
export async function own<T extends keyof import("@/lib/db/types").Tables>(ctx: AppContext, table: T, id: string | null | undefined) {
  if (!id) return null;
  const rows = await ctx.store.select(table, { id, household_id: ctx.household.id } as never);
  if (!rows.length) throw new DbError("not_found", "Záznam nebyl nalezen.");
  return rows[0];
}

export function requireDemoSafe(ctx: AppContext) {
  return ctx.household.is_demo;
}
