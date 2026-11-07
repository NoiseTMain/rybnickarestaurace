"use server";
import { lookupAres } from "@/lib/ares";
import { checkPassword } from "@/lib/password-check";
import { canEdit } from "@/lib/context";
import { addDays, formatDate, todayISO } from "@/lib/dates";
import type { HouseholdSettings, IcoInfo } from "@/lib/db/types";
import { done, fail, withContext } from "./helpers";
import type { ActionResult } from "./result";

export async function checkIco(ico: string): Promise<{ ok: boolean; error?: string; info?: IcoInfo; ceased?: boolean }> {
  const r = await lookupAres(String(ico).replace(/\s/g, ""));
  return r.ok ? { ok: true, info: r.info, ceased: r.ceased } : { ok: false, error: r.error };
}

/** Aktivace / změna IČO: ověření v ARES, heslo, změna nejvýše 1× za 30 dní. */
export async function activateIco(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    if (!canEdit(ctx, "settings")) return fail("Nemáte oprávnění měnit nastavení domácnosti.");
    const ico = String(fd.get("ico") ?? "").replace(/\s/g, "");
    const [settings] = (await ctx.store.select("household_settings", { household_id: ctx.household.id })) as HouseholdSettings[];
    if (!settings) return fail("Chybí nastavení domácnosti.");
    if (settings.billing_ico === ico && settings.ico_activated_at) return fail("Toto IČO už je aktivní.");
    const changing = Boolean(settings.billing_ico && settings.ico_activated_at);
    if (changing && settings.ico_changed_at) {
      const next = addDays(settings.ico_changed_at.slice(0, 10), 30);
      if (next > todayISO()) return fail(`IČO lze měnit nejvýše jednou za 30 dní. Další změna bude možná ${formatDate(next)}.`);
    }
    if (!(await checkPassword(ctx.user, String(fd.get("password") ?? "")))) return fail("Nesprávné heslo.", { password: "Nesprávné heslo" });
    const r = await lookupAres(ico);
    let info: IcoInfo;
    if (r.ok) info = r.info;
    else if (fd.get("manual") === "on" && !("notFound" in r && r.notFound) && /^\d{8}$/.test(ico)) {
      // ARES nedostupný – lze uložit neověřené, ověří se později
      info = { ico, name: null, address: null, legalForm: null, dic: null, established: null, verified: false, source: "manual", checkedAt: new Date().toISOString() };
    } else return fail(r.error, { ico: r.error });
    const now = new Date().toISOString();
    await ctx.store.update("household_settings", { household_id: ctx.household.id }, {
      billing_ico: ico,
      ico_info: info,
      ico_activated_at: settings.ico_activated_at ?? now,
      ico_changed_at: now,
      billing_name: settings.billing_name ?? info.name,
      billing_address: settings.billing_address ?? info.address,
      billing_dic: settings.billing_dic ?? info.dic,
    });
    return done(changing ? "IČO změněno a ověřeno" : info.verified ? "IČO aktivováno a ověřeno v registru ARES" : "IČO aktivováno (zatím neověřeno v ARES)");
  });
}
