import "server-only";
import { createHash } from "node:crypto";
import { Resend } from "resend";
import type { AdminContext } from "@/lib/auth";
import { safeFilename } from "@/lib/png";
import { serverEnv } from "@/lib/server-env";
import { formatMenuDate } from "@/lib/time";
import type { DailyMenu, EmailStatus, PrivateSettings, SiteSettings } from "@/lib/types";

export type MenuEmailResult =
  | { status: "sent"; recipient: string; providerId: string; sentAt: string }
  | { status: "failed"; recipient: string; error: string }
  | { status: "skipped"; reason: string }
  | { status: "busy"; current: EmailStatus; message: string };

const SEND_TIMEOUT_MS = 25_000;

export function buildMenuEmail(menuDate: string, settings: Pick<SiteSettings, "restaurant_name" | "address_street" | "address_zip" | "address_city" | "phone">) {
  const date = formatMenuDate(menuDate, { weekday: false });
  const subject = `Denní menu – ${settings.restaurant_name} – ${date}`;
  const address = `${settings.address_street}, ${settings.address_zip} ${settings.address_city}`;
  const text = [
    "Dobrý den,",
    "",
    `v příloze zasíláme denní menu ${settings.restaurant_name} pro příslušný den.`,
    "",
    "Soubor je připravený k vytištění v restauraci.",
    "",
    settings.restaurant_name,
    address,
    settings.phone,
  ].join("\n");
  const html = `<!doctype html><html lang="cs"><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1c1a17">
<p>Dobrý den,</p>
<p>v příloze zasíláme denní menu ${escapeHtml(settings.restaurant_name)} pro příslušný den.</p>
<p>Soubor je připravený k vytištění v restauraci.</p>
<p style="margin-top:24px">${escapeHtml(settings.restaurant_name)}<br>${escapeHtml(address)}<br>${escapeHtml(settings.phone)}</p>
</body></html>`;
  return { subject, text, html };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function isEmailConfigured() {
  return Boolean(serverEnv.resendApiKey && serverEnv.emailFrom);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Vypršel časový limit e-mailové služby")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Odešle PNG menu jako přílohu. Stav „sent“ se zapíše až po potvrzení
 * od Resend (vrácené ID zprávy). Před odesláním se menu atomicky
 * „zamkne“ (claim_menu_email), takže stejné menu nelze odeslat dvakrát
 * souběžně ani obnovením stránky.
 */
export async function sendMenuEmail(
  ctx: AdminContext,
  menuId: string,
  opts: { trigger: "auto" | "manual"; force?: boolean },
): Promise<MenuEmailResult> {
  const { supabase, user } = ctx;

  const [{ data: priv, error: privError }, { data: site }] = await Promise.all([
    supabase.from("private_settings").select("*").eq("id", 1).single(),
    supabase.from("site_settings").select("restaurant_name,address_street,address_zip,address_city,phone").eq("id", 1).single(),
  ]);
  if (privError || !priv) {
    return { status: "failed", recipient: "", error: "Nepodařilo se načíst nastavení e-mailu." };
  }
  const privateSettings = priv as PrivateSettings;

  if (opts.trigger === "auto" && !privateSettings.menu_email_enabled) {
    await supabase.from("daily_menus").update({ email_status: "skipped" }).eq("id", menuId).eq("email_status", "pending");
    return { status: "skipped", reason: "Automatické odesílání je v nastavení vypnuté." };
  }

  const { data: claimed, error: claimError } = await supabase.rpc("claim_menu_email", {
    p_menu_id: menuId,
    p_force: Boolean(opts.force),
  });
  if (claimError) {
    return { status: "failed", recipient: privateSettings.menu_email_recipient, error: `Chyba databáze: ${claimError.message}` };
  }
  const menu = (Array.isArray(claimed) ? claimed[0] : claimed) as DailyMenu | undefined;
  if (!menu) {
    const { data: current } = await supabase.from("daily_menus").select("email_status").eq("id", menuId).maybeSingle();
    const status = (current?.email_status ?? "pending") as EmailStatus;
    return {
      status: "busy",
      current: status,
      message:
        status === "sent"
          ? "E-mail s tímto menu už byl odeslán. Pro opakované odeslání použijte „Znovu odeslat“."
          : status === "sending"
            ? "E-mail se právě odesílá. Počkejte prosím chvíli."
            : "E-mail teď nelze odeslat.",
    };
  }

  const recipient = privateSettings.menu_email_recipient;
  const finish = async (result: { ok: true; providerId: string } | { ok: false; error: string }) => {
    const now = new Date().toISOString();
    const patch = result.ok
      ? { email_status: "sent", email_sent_at: now, email_provider_id: result.providerId, email_last_error: null, email_recipient: recipient, email_claimed_at: null }
      : { email_status: "failed", email_last_error: result.error.slice(0, 1000), email_recipient: recipient, email_claimed_at: null };
    const [{ error: updateError }] = await Promise.all([
      supabase.from("daily_menus").update(patch).eq("id", menu.id),
      supabase.from("menu_email_log").insert({
        menu_id: menu.id,
        menu_date: menu.menu_date,
        recipient,
        status: result.ok ? "sent" : "failed",
        trigger: opts.trigger,
        provider_message_id: result.ok ? result.providerId : null,
        error: result.ok ? null : result.error.slice(0, 1000),
        created_by: user.id,
      }),
    ]);
    if (updateError) console.error("[menu-email] status update failed", updateError);
    return now;
  };

  if (!isEmailConfigured()) {
    const error = "E-mailová služba není nastavena (chybí RESEND_API_KEY nebo EMAIL_FROM).";
    await finish({ ok: false, error });
    return { status: "failed", recipient, error };
  }

  try {
    const { data: file, error: downloadError } = await supabase.storage.from("menus").download(menu.storage_path);
    if (downloadError || !file) throw new Error(`Soubor menu se nepodařilo načíst z úložiště: ${downloadError?.message ?? "neznámá chyba"}`);
    // originální bajty bez jakékoli úpravy či komprese
    const content = Buffer.from(await file.arrayBuffer());
    if (menu.sha256) {
      const digest = createHash("sha256").update(content).digest("hex");
      if (digest !== menu.sha256) throw new Error("Soubor v úložišti neodpovídá nahranému menu (kontrolní součet).");
    }

    const { subject, text, html } = buildMenuEmail(menu.menu_date, { ...FALLBACK_CONTACT, ...(site ?? {}) });
    const resend = new Resend(serverEnv.resendApiKey);
    const { data, error } = await withTimeout(
      resend.emails.send(
        {
          from: serverEnv.emailFrom,
          to: [recipient],
          subject,
          text,
          html,
          attachments: [
            {
              filename: `denni-menu-${menu.menu_date}-${safeFilename(menu.original_filename)}`,
              content,
              contentType: "image/png",
            },
          ],
        },
        // stejný pokus = stejný klíč → Resend nedoručí duplicitu při opakovaném požadavku
        { idempotencyKey: `menu-${menu.id}-${menu.email_attempts}` },
      ),
      SEND_TIMEOUT_MS,
    );
    if (error || !data?.id) throw new Error(error?.message ?? "E-mailová služba nepotvrdila přijetí zprávy.");

    const sentAt = await finish({ ok: true, providerId: data.id });
    return { status: "sent", recipient, providerId: data.id, sentAt };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[menu-email] send failed", error);
    await finish({ ok: false, error });
    return { status: "failed", recipient, error };
  }
}

const FALLBACK_CONTACT = {
  restaurant_name: "Restaurace Rybníky",
  address_street: "Rybníky 40",
  address_zip: "263 01",
  address_city: "Dobříš",
  phone: "+420 602 163 330",
};
