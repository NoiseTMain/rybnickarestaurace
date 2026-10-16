import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { isSameOrigin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { inquirySchema } from "@/lib/inquiry";
import { serverEnv } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/server";
import { formatMenuDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const MAX_PER_HOUR = 5;

/** Veřejný formulář rezervace / poptávky akce. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Neplatný původ požadavku." }, { status: 403 });
  if (!isSupabaseConfigured() || !serverEnv.supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Formulář je dočasně nedostupný. Zavolejte nám prosím." }, { status: 503 });
  }

  const parsed = inquirySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Zkontrolujte vyplněné údaje." }, { status: 400 });
  }
  const input = parsed.data;
  // honeypot vyplněný robotem – tváříme se, že vše proběhlo
  if (input.website) return NextResponse.json({ ok: true });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = createHash("sha256").update(`${serverEnv.ipHashSalt}:${ip}`).digest("hex");
  const supabase = createServiceClient();

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_HOUR) {
    return NextResponse.json({ error: "Odeslali jste příliš mnoho poptávek. Zavolejte nám prosím." }, { status: 429 });
  }

  const { data: inquiry, error } = await supabase
    .from("inquiries")
    .insert({
      kind: input.kind,
      name: input.name,
      phone: input.phone,
      email: input.email,
      event_date: input.eventDate,
      event_time: input.eventTime,
      guests: input.guests ?? null,
      space: input.space,
      message: input.message,
      ip_hash: ipHash,
    })
    .select("id")
    .single();
  if (error || !inquiry) {
    console.error("[api/inquiry] insert failed", error);
    return NextResponse.json({ error: "Poptávku se nepodařilo uložit. Zavolejte nám prosím." }, { status: 500 });
  }

  // upozornění e-mailem (není-li služba nastavena, poptávka je přesto uložena v administraci)
  if (serverEnv.resendApiKey && serverEnv.emailFrom) {
    try {
      const { data: priv } = await supabase.from("private_settings").select("inquiry_email_recipient").eq("id", 1).single();
      const label = input.kind === "event" ? "Poptávka akce / pronájmu" : "Rezervace";
      const lines = [
        `${label} z webu`,
        "",
        `Jméno: ${input.name}`,
        `Telefon: ${input.phone}`,
        input.email ? `E-mail: ${input.email}` : null,
        input.eventDate ? `Datum: ${formatMenuDate(input.eventDate)}` : null,
        input.eventTime ? `Čas: ${input.eventTime}` : null,
        input.guests ? `Počet osob: ${input.guests}` : null,
        input.space ? `Prostor: ${input.space}` : null,
        input.message ? `\nZpráva:\n${input.message}` : null,
      ].filter((l) => l !== null);
      const { data } = await new Resend(serverEnv.resendApiKey).emails.send(
        {
          from: serverEnv.emailFrom,
          to: [priv?.inquiry_email_recipient ?? "info@rybnickarestaurace.cz"],
          replyTo: input.email ?? undefined,
          subject: `${label} – ${input.name}${input.eventDate ? ` – ${formatMenuDate(input.eventDate, { weekday: false })}` : ""}`,
          text: lines.join("\n"),
        },
        { idempotencyKey: `inquiry-${inquiry.id}` },
      );
      if (data?.id) await supabase.from("inquiries").update({ email_notified: true }).eq("id", inquiry.id);
    } catch (e) {
      console.error("[api/inquiry] notification failed", e);
    }
  }

  return NextResponse.json({ ok: true });
}
