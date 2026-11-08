"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/context";
import { checkPassword } from "@/lib/password-check";
import { adminBackend, adminConfigured, isAdminEmail } from "@/lib/admin";
import { cancelSubscription } from "@/lib/billing";
import { subscriptionActive } from "@/lib/subscription";
import { appMode } from "@/lib/env";
import { LOCAL_SESSION_COOKIE } from "@/lib/auth";
import { fail } from "./helpers";
import type { ActionResult } from "./result";

/**
 * Trvalé smazání účtu (GDPR). Domácnosti, kde byl uživatel jediný, se smažou i s daty a soubory;
 * ve sdílených domácnostech vlastnictví přejde na dalšího člena. Placené předplatné se zruší.
 */
export async function deleteAccount(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { user } = await requireUser();
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "SMAZAT") return fail("Pro potvrzení napište SMAZAT.", { confirm: "Napište SMAZAT" });
  if (!(await checkPassword(user, String(fd.get("password") ?? "")))) return fail("Nesprávné heslo.", { password: "Nesprávné heslo" });
  if (isAdminEmail(user.email)) return fail("Účet správce aplikace takto smazat nelze.");
  if (!adminConfigured()) return fail("Smazání účtu teď není dostupné (chybí nastavení serveru). Napište nám prosím e-mail.");
  const backend = await adminBackend();
  const sub = (await backend.subscriptions()).find((s) => s.user_id === user.id);
  if (sub?.source === "lemonsqueezy" && subscriptionActive(sub) && sub.status !== "cancelled" && sub.provider_subscription_id) {
    if (!(await cancelSubscription(sub.provider_subscription_id))) return fail("Nepodařilo se zrušit předplatné. Zrušte ho prosím nejdřív ve „Spravovat předplatné“ a zkuste to znovu.");
  }
  await backend.audit({ admin_id: null, action: "account_deleted", target_user_id: user.id, target_email: user.email, detail: null });
  await backend.deleteUser(user.id);
  const jar = await cookies();
  if (appMode() === "local") jar.delete(LOCAL_SESSION_COOKIE);
  else for (const c of jar.getAll()) if (c.name.startsWith("sb-")) jar.delete(c.name);
  redirect("/vitejte?smazano=1");
}
