"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { appMode } from "@/lib/env";
import { createLocalSession, getUser, LOCAL_SESSION_COOKIE } from "@/lib/auth";
import { checkPassword } from "@/lib/password-check";
import { newTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";

/**
 * Dvoufázové ověření (2FA): v Supabase přes vestavěné MFA (TOTP), v lokálním režimu vlastní TOTP.
 * Kódy generuje aplikace typu Google Authenticator, Microsoft Authenticator nebo 1Password.
 */
type LocalU = { id: string; email: string; totp_secret?: string; totp_pending?: string; totp_enabled?: boolean; sessions_after?: number };

async function local() {
  return import("@/lib/db/local-store");
}

export async function mfaStatus(): Promise<{ enabled: boolean }> {
  const user = await getUser();
  if (!user) return { enabled: false };
  if (appMode() === "local") {
    const { readLocal } = await local();
    return { enabled: await readLocal((d) => Boolean((d.users.find((u) => u.id === user.id) as unknown as LocalU)?.totp_enabled)) };
  }
  const { createSessionClient } = await import("@/lib/supabase/server");
  const { data } = await (await createSessionClient()).auth.mfa.listFactors();
  return { enabled: Boolean(data?.totp?.some((f) => f.status === "verified")) };
}

export async function startMfa(): Promise<{ factorId?: string; qr?: string; secret?: string; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Nepřihlášeno" };
  if (appMode() === "local") {
    const secret = newTotpSecret();
    const { writeLocal } = await local();
    await writeLocal((d) => { const u = d.users.find((x) => x.id === user.id) as unknown as LocalU | undefined; if (u) u.totp_pending = secret; });
    const QR = await import("qrcode");
    return { factorId: "local", secret, qr: await QR.toDataURL(otpauthUri(secret, user.email), { margin: 1, width: 220 }) };
  }
  const { createSessionClient } = await import("@/lib/supabase/server");
  const supabase = await createSessionClient();
  // nedokončené pokusy smazat, ať jde začít znovu
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `HomeOS ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return { error: "Nepodařilo se zahájit nastavení 2FA." };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmMfa(factorId: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Nepřihlášeno" };
  if (appMode() === "local") {
    const { writeLocal } = await local();
    const ok = await writeLocal((d) => {
      const u = d.users.find((x) => x.id === user.id) as unknown as LocalU | undefined;
      if (!u?.totp_pending || !verifyTotp(u.totp_pending, code)) return false;
      u.totp_secret = u.totp_pending; u.totp_enabled = true; delete u.totp_pending;
      return true;
    });
    if (!ok) return { ok: false, error: "Nesprávný kód – zkuste aktuální kód z aplikace." };
    await createLocalSession(user.id, true);
    return { ok: true };
  }
  const { createSessionClient } = await import("@/lib/supabase/server");
  const { error } = await (await createSessionClient()).auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
  return error ? { ok: false, error: "Nesprávný kód – zkuste aktuální kód z aplikace." } : { ok: true };
}

export async function disableMfa(password: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Nepřihlášeno" };
  if (!(await checkPassword(user, password))) return { ok: false, error: "Nesprávné heslo." };
  if (appMode() === "local") {
    const { writeLocal } = await local();
    await writeLocal((d) => { const u = d.users.find((x) => x.id === user.id) as unknown as LocalU | undefined; if (u) { delete u.totp_secret; u.totp_enabled = false; } });
    return { ok: true };
  }
  const { createSessionClient } = await import("@/lib/supabase/server");
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.all ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id });
  return { ok: true };
}

/** Druhý krok přihlášení: kód z aplikace. */
const codeAttempts = new Map<string, number[]>();

export async function verifyLoginCode(code: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Přihlášení vypršelo – přihlaste se znovu." };
  // ochrana proti hádání kódu: max. 5 chybných pokusů za 5 minut
  const recent = (codeAttempts.get(user.id) ?? []).filter((t) => t > Date.now() - 5 * 60_000);
  if (recent.length >= 5) return { ok: false, error: "Příliš mnoho chybných kódů. Zkuste to za 5 minut." };
  const r = await verifyCodeInner(user, code);
  if (r.ok) codeAttempts.delete(user.id); else codeAttempts.set(user.id, [...recent, Date.now()]);
  return r;
}

async function verifyCodeInner(user: { id: string }, code: string): Promise<{ ok: boolean; error?: string }> {
  if (appMode() === "local") {
    const { readLocal } = await local();
    const secret = await readLocal((d) => (d.users.find((x) => x.id === user.id) as unknown as LocalU | undefined)?.totp_secret);
    if (!secret || !verifyTotp(secret, code)) return { ok: false, error: "Nesprávný kód." };
    await createLocalSession(user.id, true);
    return { ok: true };
  }
  const { createSessionClient } = await import("@/lib/supabase/server");
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp?.find((f) => f.status === "verified");
  if (!factor) return { ok: false, error: "2FA není nastavené." };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\s/g, "") });
  return error ? { ok: false, error: "Nesprávný kód." } : { ok: true };
}

/** Odhlásí účet na všech zařízeních (i ztraceném telefonu). */
export async function signOutEverywhere(): Promise<void> {
  const user = await getUser();
  if (appMode() === "local") {
    if (user) {
      const { writeLocal } = await local();
      await writeLocal((d) => { const u = d.users.find((x) => x.id === user.id) as unknown as LocalU | undefined; if (u) u.sessions_after = Date.now(); });
    }
    (await cookies()).delete(LOCAL_SESSION_COOKIE);
  } else {
    const { createSessionClient } = await import("@/lib/supabase/server");
    await (await createSessionClient()).auth.signOut({ scope: "global" });
  }
  redirect("/prihlaseni");
}
