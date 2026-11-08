import "server-only";
import type { AppUser } from "@/lib/auth";
import type { Store } from "@/lib/db/store";
import type { Transaction } from "@/lib/db/types";
import { addDays, addMonths, endOfMonth, startOfMonth, type ISODate } from "@/lib/dates";
import { occurrences } from "@/lib/finance/recurrence";

/**
 * UKÁZKOVÁ DATA – vkládají se VÝHRADNĚ do samostatné demo domácnosti
 * (households.is_demo = true). Nikdy se nemíchají se skutečnými financemi.
 * Všechny názvy jsou označené jako ukázkové.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export async function seedDemo(store: Store, user: AppUser, hid: string, today: ISODate) {
  const rand = rng(20261106);
  const between = (min: number, max: number) => Math.round((min + rand() * (max - min)) / 100) * 100; // haléře, celé Kč
  const cats = await store.select("categories", { household_id: hid });
  const cat = (name: string) => cats.find((c) => c.name === name)!.id;

  const [a, b] = await store.insert("members", [
    { household_id: hid, name: "Petra (demo)", color: "#d4b483", user_id: user.id, is_active: true, sort: 0 },
    { household_id: hid, name: "Tomáš (demo)", color: "#9ccc65", user_id: null, is_active: true, sort: 1 },
  ]);
  const start = addMonths(startOfMonth(today), -3);
  const [main, cash, savings] = await store.insert("accounts", [
    { household_id: hid, name: "Běžný účet (demo)", kind: "checking", opening_balance: 4_850_000, opening_date: start, include_in_available: true, member_id: null, is_active: true, sort: 0 },
    { household_id: hid, name: "Hotovost (demo)", kind: "cash", opening_balance: 800_000, opening_date: start, include_in_available: true, member_id: null, is_active: true, sort: 1 },
    { household_id: hid, name: "Spořicí účet (demo)", kind: "savings", opening_balance: 6_000_000, opening_date: start, include_in_available: false, member_id: null, is_active: true, sort: 2 },
  ]);

  const recurring = await store.insert("recurring_payments", [
    { name: "Nájem (demo)", amount: 1_450_000, frequency: "monthly", start_date: addDays(start, 4), category_id: cat("Nájem"), payment_method: "transfer" },
    { name: "Elektřina – záloha (demo)", amount: 180_000, frequency: "monthly", start_date: addDays(start, 14), category_id: cat("Elektřina"), payment_method: "direct_debit" },
    { name: "Internet (demo)", amount: 59_900, frequency: "monthly", start_date: addDays(start, 9), category_id: cat("Internet"), payment_method: "direct_debit" },
    { name: "Telefony (demo)", amount: 79_800, frequency: "monthly", start_date: addDays(start, 19), category_id: cat("Telefony"), payment_method: "direct_debit" },
    { name: "Pojištění domácnosti (demo)", amount: 360_000, frequency: "quarterly", start_date: addDays(start, 24), category_id: cat("Pojištění"), payment_method: "transfer" },
    { name: "Splátka spotřebiče (demo)", amount: 120_000, frequency: "monthly", start_date: addDays(start, 21), category_id: cat("Domácí potřeby"), payment_method: "transfer", is_debt: true, debt_remaining: 720_000 },
  ].map((r) => ({ household_id: hid, end_date: null, account_id: main.id, member_id: null, is_debt: false, debt_remaining: null, is_active: true, note: null, ...r } as never)));

  const [salary] = await store.insert("income_sources", [{
    household_id: hid, name: "Mzda Petra (demo)", amount: 3_200_000, frequency: "monthly", start_date: addDays(start, 11), end_date: null,
    member_id: a.id, account_id: main.id, category_id: cat("Mzda / výplata"), is_active: true, note: null,
  }]);

  const txs: Partial<Transaction>[] = [];
  const base = { household_id: hid, status: "posted" as const, transfer_account_id: null, scope: "shared" as const, cancelled_at: null, note: null };
  // pravidelné platby a mzda – zaplacené termíny do dneška
  for (const r of recurring) {
    for (const d of occurrences(r, start, today)) {
      txs.push({ ...base, type: "expense", amount: r.amount, date: d, account_id: main.id, category_id: r.category_id, description: r.name, member_id: null,
        is_recurring: true, payment_method: r.payment_method, source: "recurring", recurring_payment_id: r.id, occurrence_date: d });
    }
  }
  for (const d of occurrences(salary, start, addDays(today, -1))) {
    txs.push({ ...base, type: "income", amount: salary.amount, date: d, account_id: main.id, category_id: salary.category_id, description: salary.name,
      member_id: a.id, is_recurring: true, payment_method: "transfer", source: "income_source", income_source_id: salary.id, occurrence_date: d });
  }
  // běžné výdaje
  const shops = ["Albert (demo)", "Lidl (demo)", "Billa (demo)", "Rohlík.cz (demo)", "Pekárna (demo)"];
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (rand() < 0.55) txs.push({ ...base, type: "expense", amount: between(15_000, 120_000), date: d, account_id: rand() < 0.95 ? main.id : cash.id, category_id: cat("Potraviny"),
      description: shops[Math.floor(rand() * shops.length)], member_id: rand() < 0.5 ? a.id : b.id, is_recurring: false, payment_method: "card", source: "manual" });
    if (rand() < 0.08) txs.push({ ...base, type: "expense", amount: between(8_000, 45_000), date: d, account_id: main.id, category_id: cat("Drogerie"), description: "Drogerie (demo)", member_id: a.id, is_recurring: false, payment_method: "card", source: "manual" });
    if (rand() < 0.07) txs.push({ ...base, type: "expense", amount: between(30_000, 110_000), date: d, account_id: main.id, category_id: cat("Restaurace"), description: "Restaurace (demo)", member_id: b.id, is_recurring: false, payment_method: "card", source: "manual" });
    if (rand() < 0.05) txs.push({ ...base, type: "expense", amount: between(80_000, 160_000), date: d, account_id: main.id, category_id: cat("Auto"), description: "Tankování (demo)", member_id: b.id, scope: "personal", is_recurring: false, payment_method: "card", source: "manual" });
    if (rand() < 0.04) txs.push({ ...base, type: "expense", amount: between(20_000, 90_000), date: d, account_id: main.id, category_id: cat("Zábava"), description: "Kino a volný čas (demo)", member_id: a.id, scope: "personal", is_recurring: false, payment_method: "card", source: "manual" });
  }

  // práce – směny a výplaty
  await store.update("work_settings", { household_id: hid }, {
    member_id: b.id, company: "Rohlík (demo)", job_type: "courier", position: "kurýr", rate_hour: 18_000, rate_regular_route: 4_000, rate_express_route: 7_000, rate_order: 0, rate_peak_hour_bonus: 3_000, private_km_rate: 500, default_vehicle_rent: 25_000,
  });
  const shifts = [];
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const dow = new Date(d + "T00:00:00Z").getUTCDay();
    if (dow === 0 || rand() < 0.35) continue;
    const minutes = 360 + Math.round(rand() * 4) * 30;
    const peak = 120 + Math.round(rand() * 2) * 30;
    const reg = 2 + Math.floor(rand() * 3), exp = Math.floor(rand() * 2);
    const orders = 18 + Math.floor(rand() * 14);
    const km = (Math.round(rand() * 80) / 10).toFixed(1);
    shifts.push({
      household_id: hid, member_id: b.id, date: d, minutes, peak_minutes: peak, regular_routes: reg, express_routes: exp, orders,
      base_earnings: Math.round((18_000 * minutes) / 60) + Math.round((3_000 * peak) / 60) + 4_000 * reg + 7_000 * exp,
      tips: between(0, 25_000), bonuses: rand() < 0.15 ? 50_000 : 0, rewards: 0, vehicle_rent: 25_000, equipment_cost: 0,
      private_km: km, private_km_cost: Math.round(500 * Number(km)), other_deductions: 0, note: null, external_id: null,
    });
  }
  await store.insert("work_shifts", shifts);
  const payouts = [];
  for (let i = 3; i >= 0; i--) {
    const m = addMonths(startOfMonth(today), -i);
    const prev = addMonths(m, -1);
    if (prev < start) continue;
    const expected = shifts.filter((s) => s.date >= prev && s.date <= endOfMonth(prev)).reduce((acc, s) => acc + s.base_earnings + s.tips + s.bonuses - s.vehicle_rent - s.private_km_cost, 0);
    const expectedDate = addDays(m, 14);
    const received = expectedDate < today;
    const amount = received ? expected - (rand() < 0.5 ? 0 : 35_000) : null;
    payouts.push({
      household_id: hid, member_id: b.id, label: `Výplata Rohlík ${prev.slice(5, 7)}/${prev.slice(0, 4)} (demo)`, period_from: prev, period_to: endOfMonth(prev),
      expected_amount: expected, expected_date: expectedDate, received_amount: amount, received_date: received ? expectedDate : null,
      status: received ? "received" : "expected", account_id: main.id, invoice_id: null, note: null,
    });
  }
  const insertedPayouts = await store.insert("payouts", payouts as never);
  for (const p of insertedPayouts) {
    if (p.status === "received" && p.received_amount) {
      txs.push({ ...base, type: "income", amount: p.received_amount, date: p.received_date!, account_id: main.id, category_id: cat("Práce / brigády"), description: p.label,
        member_id: b.id, is_recurring: false, payment_method: "transfer", source: "payout", payout_id: p.id });
    }
  }
  await store.insert("transactions", txs.map((t) => ({ external_id: null, document_id: null, ...t })));

  // faktury
  await store.insert("invoices", [
    { direction: "issued", number: "DEMO-2026-011", counterparty: "Odběratel s.r.o. (demo)", counterparty_ico: "27082440", issue_date: addDays(today, -40), due_date: addDays(today, -26), amount: 1_250_000, status: "unpaid", paid_date: null, note: "Ukázková faktura po splatnosti" },
    { direction: "issued", number: "DEMO-2026-012", counterparty: "Odběratel s.r.o. (demo)", counterparty_ico: "27082440", issue_date: addDays(today, -5), due_date: addDays(today, 9), amount: 980_000, status: "unpaid", paid_date: null, note: null },
    { direction: "received", number: "FV-DEMO-77", counterparty: "Servis vozidel (demo)", counterparty_ico: null, issue_date: addDays(today, -3), due_date: addDays(today, 11), amount: 240_000, status: "unpaid", paid_date: null, note: null },
    { direction: "issued", number: "DEMO-2026-010", counterparty: "Odběratel s.r.o. (demo)", counterparty_ico: "27082440", issue_date: addDays(today, -70), due_date: addDays(today, -56), amount: 1_100_000, status: "paid", paid_date: addDays(today, -55), note: null },
  ].map((i) => ({ household_id: hid, include_in_plan: true, document_id: null, ocr_used: false, ...i } as never)));

  // rozpočty, cíle, nákupy
  await store.insert("budgets", [
    { household_id: hid, kind: "food", category_id: null, amount: 1_200_000, month: null },
    { household_id: hid, kind: "category", category_id: cat("Restaurace"), amount: 200_000, month: null },
    { household_id: hid, kind: "category", category_id: cat("Zábava"), amount: 150_000, month: null },
  ]);
  const [reserve, vacation] = await store.insert("savings_goals", [
    { household_id: hid, name: "Finanční rezerva (demo)", kind: "reserve", target_amount: 12_000_000, target_date: null, monthly_contribution: 300_000, account_id: savings.id, color: "#d4b483", priority: 1, status: "active", note: null },
    { household_id: hid, name: "Dovolená u moře (demo)", kind: "vacation", target_amount: 4_000_000, target_date: addMonths(endOfMonth(today), 7), monthly_contribution: null, account_id: null, color: "#7fb3d5", priority: 2, status: "active", note: null },
  ]);
  await store.insert("savings_contributions", [
    { household_id: hid, goal_id: reserve.id, amount: 6_000_000, date: start, note: "Počáteční stav (demo)" },
    { household_id: hid, goal_id: vacation.id, amount: 400_000, date: addMonths(start, 1), note: null },
    { household_id: hid, goal_id: vacation.id, amount: 400_000, date: addMonths(start, 2), note: null },
  ]);
  await store.insert("purchases", [
    { name: "Sedačka (demo)", price: 1_500_000, priority: 2, status: "planned", is_wish: false, planned_date: addMonths(today, 2), url: null },
    { name: "Robotický vysavač (demo)", price: 699_000, priority: 3, status: "planned", is_wish: true, planned_date: null, url: null },
    { name: "Zimní pneumatiky (demo)", price: 1_100_000, priority: 1, status: "buying", is_wish: false, planned_date: addDays(today, 10), url: null },
  ].map((p) => ({ household_id: hid, category_id: null, note: null, kind: "general", room: null, image_document_id: null, source_url_title: null, ...p } as never)));
  await store.insert("purchases", [
    { name: "Komoda do ložnice (demo)", price: 499_000, priority: 2, room: "Ložnice", url: null },
    { name: "Jídelní stůl a 4 židle (demo)", price: 1_290_000, priority: 3, room: "Kuchyně", url: null },
    { name: "Koberec do obýváku (demo)", price: 259_000, priority: 4, room: "Obývací pokoj", url: null, is_wish: true },
  ].map((p) => ({ household_id: hid, category_id: null, note: null, status: "planned", is_wish: false, planned_date: null, kind: "home", image_document_id: null, source_url_title: null, ...p } as never)));
  const [list] = await store.insert("shopping_lists", [{ household_id: hid, name: "Velký nákup na víkend (demo)", planned_date: addDays(today, 1), status: "open", note: "Lidl" }]);
  await store.insert("shopping_items", [
    ["Mléko 2×", "2 ks", 4_980], ["Chléb", "1 ks", 4_490], ["Kuřecí prsa", "1 kg", 18_990], ["Zelenina na salát", null, 8_900], ["Těstoviny", "2 bal.", 5_980], ["Káva", "1 ks", null],
  ].map(([name, quantity, est_price], i) => ({ household_id: hid, list_id: list.id, name: name as string, quantity: quantity as string | null, est_price: est_price as number | null, checked: i < 2, sort: i })));

  // cestování: proběhlá cesta (s výdaji) a chystaná cesta (s trasou)
  const pastStart = addDays(today, -40);
  const nextStart = addDays(today, 35);
  const [past, next] = await store.insert("trips", [
    { household_id: hid, name: "Víkend ve Vídni (demo)", destination: "Vídeň", country: "Rakousko", start_date: pastStart, end_date: addDays(pastStart, 2), travelers: 2, budget: 900_000, currency: "EUR", lat: 48.2083, lon: 16.3725, note: null },
    { household_id: hid, name: "Léto v Chorvatsku (demo)", destination: "Split", country: "Chorvatsko", start_date: nextStart, end_date: addDays(nextStart, 7), travelers: 2, budget: 3_500_000, currency: "EUR", lat: 43.5081, lon: 16.4402, note: "Apartmán 5 min od pláže" },
  ]);
  const [pastLeg1, pastLeg2] = await store.insert("trip_legs", [
    { household_id: hid, trip_id: past.id, mode: "train", carrier: "RegioJet", from_place: "Praha", to_place: "Vídeň", depart_date: pastStart, depart_time: "07:04", arrive_date: pastStart, arrive_time: "11:02", price: 79_800, distance_km: 330, booking_ref: null, url: null, note: null, from_lat: 50.0755, from_lon: 14.4378, to_lat: 48.2083, to_lon: 16.3725, sort: 0 },
    { household_id: hid, trip_id: past.id, mode: "bus", carrier: "FlixBus", from_place: "Vídeň", to_place: "Praha", depart_date: addDays(pastStart, 2), depart_time: "17:30", arrive_date: addDays(pastStart, 2), arrive_time: "21:45", price: 49_800, distance_km: 330, booking_ref: null, url: null, note: null, from_lat: 48.2083, from_lon: 16.3725, to_lat: 50.0755, to_lon: 14.4378, sort: 1 },
    { household_id: hid, trip_id: next.id, mode: "car", carrier: "Vlastní auto", from_place: "Praha", to_place: "Split", depart_date: nextStart, depart_time: "05:00", arrive_date: nextStart, arrive_time: "17:00", price: 420_000, distance_km: 1050, booking_ref: null, url: null, note: "dálniční známky AT, SI + mýto HR", from_lat: 50.0755, from_lon: 14.4378, to_lat: 43.5081, to_lon: 16.4402, sort: 0 },
    { household_id: hid, trip_id: next.id, mode: "ferry", carrier: "Jadrolinija", from_place: "Split", to_place: "Hvar", depart_date: addDays(nextStart, 3), depart_time: "09:15", arrive_date: null, arrive_time: null, price: 60_000, distance_km: null, booking_ref: null, url: null, note: null, from_lat: 43.5081, from_lon: 16.4402, to_lat: 43.1729, to_lon: 16.4411, sort: 1 },
  ]);
  const eur = (cents: number, rate = 25.2) => ({ currency: "EUR", amount_original: cents, rate, amount: Math.round(cents * rate) });
  const [pp, pt, np, nt] = await store.insert("trip_people", [
    { household_id: hid, trip_id: past.id, name: "Petra", member_id: a.id, sort: 0 },
    { household_id: hid, trip_id: past.id, name: "Tomáš", member_id: b.id, sort: 1 },
    { household_id: hid, trip_id: next.id, name: "Petra", member_id: a.id, sort: 0 },
    { household_id: hid, trip_id: next.id, name: "Tomáš", member_id: b.id, sort: 1 },
  ]);
  await store.insert("trip_cash_moves", [{ household_id: hid, trip_id: past.id, kind: "buy", currency: "EUR", amount_original: 10_000, amount: 253_000, rate: 25.3, date: pastStart, transaction_id: null, note: "bankomat na nádraží (demo)" }]);
  const cashEur = (cents: number) => ({ currency: "EUR", amount_original: cents, rate: 25.3, amount: Math.round(cents * 25.3), from_cash: true });
  const payer = new Map<string, string>([["Vlak Praha → Vídeň", pp.id], ["Hotel 2 noci", pp.id], ["Bus Vídeň → Praha", pt.id], ["Řízek a pivo", pt.id], ["Schönbrunn – vstupné", pp.id], ["MHD 72h jízdenka", pt.id], ["Apartmán – záloha", np.id]]);
  void nt;
  await store.insert("trip_checklist", [
    ["Občanský průkaz / pas", "Doklady", true], ["Cestovní pojištění", "Doklady", true], ["Kartička zdravotní pojišťovny (EHIC)", "Doklady", false],
    ["Dálniční známky / mýto na trase", "Auto", false], ["Zelená karta (pojištění auta)", "Auto", true], ["Opalovací krém", "Moře", false], ["Boty do vody", "Moře", false],
    ["Zalít květiny, vynést koš", "Doma", false],
  ].map(([text, category, done], i) => ({ household_id: hid, trip_id: next.id, text: text as string, category: category as string, done: done as boolean, sort: i })));
  await store.insert("trip_plan_items", [
    { household_id: hid, trip_id: next.id, kind: "stay", date: nextStart, end_date: addDays(nextStart, 7), time: "16:00", title: "Apartmán Ivana (demo)", address: "Put Firula 12, Split", url: null, note: "klíče v schránce, kód 1234" },
    { household_id: hid, trip_id: next.id, kind: "activity", date: addDays(nextStart, 3), end_date: null, time: "10:30", title: "Hvar – procházka a koupání", address: "Hvar", url: null, note: null },
    { household_id: hid, trip_id: next.id, kind: "activity", date: addDays(nextStart, 5), end_date: null, time: "09:00", title: "Národní park Krka", address: "Krka, Chorvatsko", url: "https://www.npkrka.hr", note: "vstupné ~40 EUR/os." },
  ]);
  await store.insert("trip_expenses", [
    { trip_id: past.id, leg_id: pastLeg1.id, status: "paid", kind: "transport", description: "Vlak Praha → Vídeň", place: "Praha", date: pastStart, amount: 79_800, currency: "CZK", amount_original: null, rate: null },
    { trip_id: past.id, leg_id: pastLeg2.id, status: "paid", kind: "transport", description: "Bus Vídeň → Praha", place: "Vídeň", date: addDays(pastStart, 2), amount: 49_800, currency: "CZK", amount_original: null, rate: null },
    { trip_id: past.id, leg_id: null, status: "paid", kind: "accommodation", description: "Hotel 2 noci", place: "Vídeň", date: pastStart, ...eur(18_000) },
    { trip_id: past.id, leg_id: null, status: "paid", kind: "food", description: "Řízek a pivo", place: "Figlmüller", date: pastStart, ...eur(4_640) },
    { trip_id: past.id, leg_id: null, status: "paid", kind: "activities", description: "Schönbrunn – vstupné", place: "Schönbrunn", date: addDays(pastStart, 1), ...eur(4_400) },
    { trip_id: past.id, leg_id: null, status: "paid", kind: "food", description: "Kafe a dort", place: "Café Sacher", date: addDays(pastStart, 1), paid_by: pp.id, ...cashEur(2_380) },
    { trip_id: past.id, leg_id: null, status: "paid", kind: "shopping", description: "Suvenýry", place: "Naschmarkt", date: addDays(pastStart, 2), paid_by: pp.id, split_among: [pp.id], ...cashEur(1_950) },
    { trip_id: past.id, leg_id: null, status: "paid", kind: "transport", description: "MHD 72h jízdenka", place: "Vídeň", date: pastStart, ...eur(3_400) },
    { trip_id: next.id, leg_id: null, status: "paid", kind: "accommodation", description: "Apartmán – záloha", place: "Split", date: addDays(today, -10), ...eur(30_000, 25.1) },
    { trip_id: next.id, leg_id: null, status: "planned", kind: "accommodation", description: "Apartmán – doplatek", place: "Split", date: nextStart, ...eur(42_000, 25.1) },
  ].map((e) => ({ household_id: hid, transaction_id: null, paid_by: payer.get(e.description) ?? null, split_among: null, from_cash: false, document_id: null, ...e } as never)));

  await store.insert("assets", [
    { household_id: hid, name: "ETF portfolio (demo)", kind: "investment", value: 18_500_000, note: null },
    { household_id: hid, name: "Škoda Octavia (demo)", kind: "vehicle", value: 21_000_000, note: "odhad prodejní ceny" },
    { household_id: hid, name: "Penzijní spoření (demo)", kind: "pension", value: 9_600_000, note: null },
  ]);
  await store.insert("debts", [
    { household_id: hid, name: "Kreditní karta (demo)", balance: 1_850_000, rate: 21.9, min_payment: 150_000, note: null },
    { household_id: hid, name: "Půjčka na auto (demo)", balance: 12_400_000, rate: 6.9, min_payment: 480_000, note: null },
  ]);
  await store.insert("reminders", [
    { household_id: hid, title: "STK Octavia (demo)", kind: "stk", due_date: addDays(today, 10), notify_days: 30, repeat_yearly: false, done: false, note: null },
    { household_id: hid, title: "Povinné ručení – výročí (demo)", kind: "insurance", due_date: addDays(today, 45), notify_days: 60, repeat_yearly: true, done: false, note: "porovnat nabídky" },
    { household_id: hid, title: "Záruka pračky (demo)", kind: "warranty", due_date: addDays(today, 200), notify_days: 30, repeat_yearly: false, done: false, note: null },
  ]);

  await store.update("household_settings", { household_id: hid }, {
    safety_buffer: 500_000, onboarded_at: new Date().toISOString(), billing_ico: "00000027", ico_activated_at: new Date().toISOString(), ico_changed_at: null,
    ico_info: { ico: "00000027", name: "Ukázkový podnikatel (demo)", address: "Ukázková 1, Praha", legalForm: "Fyzická osoba podnikající (živnostník)", dic: null, established: null, verified: false, source: "manual", checkedAt: new Date().toISOString() },
  });
}
