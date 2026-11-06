"use server";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appMode } from "@/lib/env";
import { createLocalSession, hashPassword, LOCAL_SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { HOUSEHOLD_COOKIE } from "@/lib/context";
import { createSessionClient } from "@/lib/supabase/server";
import { fail } from "./helpers";
import type { ActionResult } from "./result";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Zadejte platný e-mail"),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků").max(200),
});

function parseCreds(fd: FormData) {
  const r = credentials.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (r.success) return { ok: true as const, data: r.data };
  const fieldErrors: Record<string, string> = {};
  for (const i of r.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
  return { ok: false as const, result: fail("Zkontrolujte údaje.", fieldErrors) };
}

export async function signIn(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const p = parseCreds(fd);
  if (!p.ok) return p.result;
  const { email, password } = p.data;
  if (appMode() === "local") {
    const { readLocal } = await import("@/lib/db/local-store");
    const user = await readLocal((d) => d.users.find((u) => u.email === email));
    if (!user || !(await verifyPassword(password, user.password_hash))) return fail("Nesprávný e-mail nebo heslo.");
    await createLocalSession(user.id);
  } else {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return fail(error.message.includes("confirm") ? "E-mail ještě nebyl potvrzen – zkontrolujte schránku." : "Nesprávný e-mail nebo heslo.");
  }
  redirect("/");
}

export async function signUp(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const p = parseCreds(fd);
  if (!p.ok) return p.result;
  const { email, password } = p.data;
  if (fd.get("password") !== fd.get("password2")) return fail("Hesla se neshodují.", { password2: "Hesla se neshodují" });
  if (appMode() === "local") {
    const { writeLocal } = await import("@/lib/db/local-store");
    const hash = await hashPassword(password);
    const id = await writeLocal((d) => {
      if (d.users.some((u) => u.email === email)) return null;
      const id = randomUUID();
      d.users.push({ id, email, password_hash: hash, created_at: new Date().toISOString() });
      return id;
    });
    if (!id) return fail("Účet s tímto e-mailem už existuje.");
    await createLocalSession(id);
    redirect("/uvod");
  }
  const supabase = await createSessionClient();
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/confirm` } });
  if (error) return fail(error.message.includes("registered") ? "Účet s tímto e-mailem už existuje." : `Registrace selhala: ${error.message}`);
  if (!data.session) return { ok: true, message: "Poslali jsme vám e-mail s potvrzovacím odkazem. Po potvrzení se přihlaste.", at: Date.now() };
  redirect("/uvod");
}

export async function signOut() {
  const jar = await cookies();
  if (appMode() === "local") jar.delete(LOCAL_SESSION_COOKIE);
  else {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  }
  jar.delete(HOUSEHOLD_COOKIE);
  redirect("/prihlaseni");
}

export async function requestPasswordReset(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return fail("Zadejte platný e-mail.", { email: "Zadejte platný e-mail" });
  if (appMode() === "local") return fail("V lokálním režimu se heslo obnovuje smazáním souboru .data/homeos.json (viz README).");
  const supabase = await createSessionClient();
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm?next=/nastaveni%23ucet` });
  return { ok: true, message: "Pokud účet existuje, poslali jsme e-mail s odkazem pro nastavení nového hesla.", at: Date.now() };
}

export async function changePassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return fail("Heslo musí mít alespoň 8 znaků.", { password: "Alespoň 8 znaků" });
  if (appMode() === "local") {
    const { getUser } = await import("@/lib/auth");
    const user = await getUser();
    if (!user) return fail("Nejste přihlášeni.");
    const { writeLocal } = await import("@/lib/db/local-store");
    const hash = await hashPassword(password);
    await writeLocal((d) => {
      const u = d.users.find((x) => x.id === user.id);
      if (u) u.password_hash = hash;
    });
  } else {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return fail(`Změna hesla selhala: ${error.message}`);
  }
  return { ok: true, message: "Heslo bylo změněno.", at: Date.now() };
}
