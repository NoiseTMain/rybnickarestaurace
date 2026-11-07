import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { publicEnv } from "@/lib/env";
import { cronConfigured, sendPush } from "@/lib/push";
import { createSupabaseStore } from "@/lib/db/supabase-store";
import { loadHouseholdData } from "@/lib/data";
import { computeSnapshot } from "@/lib/finance/snapshot";
import { weeklySummary } from "@/lib/finance/insights";
import { todayISO } from "@/lib/dates";

/**
 * Týdenní souhrn na telefon (Vercel Cron, neděle večer). Chráněno CRON_SECRET.
 * Service-role klíč se používá jen zde na serveru – nikdy se neposílá do prohlížeče.
 */
export async function GET(req: Request) {
  if (!cronConfigured()) return NextResponse.json({ error: "Oznámení nejsou nastavena" }, { status: 501 });
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const admin = createClient(publicEnv.supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const store = createSupabaseStore(admin);
  const subs = await store.select("push_subscriptions");
  const byHousehold = new Map<string, typeof subs>();
  for (const s of subs) byHousehold.set(s.household_id, [...(byHousehold.get(s.household_id) ?? []), s]);
  let sent = 0;
  const today = todayISO();
  for (const [hid, list] of byHousehold) {
    const data = await loadHouseholdData(store, hid);
    const w = weeklySummary(computeSnapshot(data, today), data);
    for (const s of list) {
      try {
        await sendPush(s, { title: "HomeOS – týdenní souhrn", body: w.lines.slice(0, 3).join(" "), url: "/asistent" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await store.remove("push_subscriptions", { id: s.id } as never); // odběr zanikl
      }
    }
  }
  return NextResponse.json({ ok: true, sent });
}
