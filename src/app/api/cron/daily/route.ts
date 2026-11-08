import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { publicEnv } from "@/lib/env";
import { cronConfigured, sendPush } from "@/lib/push";
import { createSupabaseStore } from "@/lib/db/supabase-store";
import { loadHouseholdData } from "@/lib/data";
import { addDays, todayISO } from "@/lib/dates";
import { travelAlerts } from "@/lib/finance/travel-alerts";
import { monthlyClosing } from "@/lib/finance/closing";
import { addMonths, startOfMonth } from "@/lib/dates";

/**
 * Denní upozornění (Vercel Cron, večer): den před odjezdem rozpis cesty,
 * během cesty upozornění na překročení denního limitu. Každé se pošle jen jednou.
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
  const today = todayISO();
  let sent = 0;
  for (const [hid, list] of byHousehold) {
    if (!(await store.householdPremium(hid))) continue; // upozornění jsou Premium
    const data = await loadHouseholdData(store, hid);
    if (today.slice(8) === "01") {
      const c = monthlyClosing(data, addMonths(startOfMonth(today), -1));
      if (c.txCount > 0) {
        for (const s of list) {
          try {
            await sendPush(s, { title: `Uzávěrka: ${c.label}`, body: [c.verdict.text, ...c.highlights.slice(0, 2)].join(" "), url: "/uzaverka" });
            sent++;
          } catch { /* neplatný odběr se smaže při dalších upozorněních */ }
        }
      }
    }
    const sentBefore = await store.select("trip_notifications", { household_id: hid });
    for (const a of travelAlerts(data, today)) {
      if (sentBefore.some((n) => n.trip_id === a.tripId && n.kind === a.kind && n.date === today)) continue;
      // záznam nejdřív – při souběžném spuštění unikátní klíč zabrání dvojímu odeslání
      try {
        await store.insert("trip_notifications", [{ household_id: hid, trip_id: a.tripId, kind: a.kind, date: today }]);
      } catch {
        continue;
      }
      for (const s of list) {
        try {
          await sendPush(s, { title: a.title, body: a.body, url: `/cestovani/${a.tripId}` });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await store.remove("push_subscriptions", { id: s.id } as never);
        }
      }
    }
    // staré záznamy mazat netřeba – jsou malé; ponecháme 60 dní
    const old = sentBefore.filter((n) => n.date < addDays(today, -60));
    for (const n of old) await store.remove("trip_notifications", { id: n.id } as never).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, sent });
}
