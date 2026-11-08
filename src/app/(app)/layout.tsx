import { redirect } from "next/navigation";
import { requireContext } from "@/lib/context";
import { loadData } from "@/lib/data";
import { addDays, todayISO } from "@/lib/dates";
import { wallets } from "@/lib/finance/travel";
import { getPremium } from "@/lib/premium";
import { getPrefs } from "@/lib/prefs";
import { PremiumPromo } from "@/components/premium/PremiumPromo";
import { localModeBlocked } from "@/lib/env";
import { LookupsProvider } from "@/components/Lookups";
import { Shell } from "@/components/shell/Shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (localModeBlocked()) redirect("/konfigurace");
  const ctx = await requireContext();
  const data = await loadData(ctx);
  // samooprava: každý uživatel s přístupem má v domácnosti svého člena (výběr „Kdo platil / Komu“)
  let members = data.members;
  if (!members.some((m) => m.user_id === ctx.user.id)) {
    await ctx.store.ensureOwnMember(ctx.household.id).catch(() => undefined);
    members = await ctx.store.select("members", { household_id: ctx.household.id });
  }
  const [premium, prefs] = await Promise.all([getPremium(ctx), getPrefs(ctx.store, ctx.user)]);
  return (
    <LookupsProvider
      value={{
        mode: ctx.store.mode,
        householdId: ctx.household.id,
        isDemo: ctx.household.is_demo,
        today: todayISO(),
        ownIco: data.settings?.billing_ico ?? null,
        accounts: data.accounts,
        categories: data.categories,
        members,
        role: ctx.role,
        permissions: ctx.permissions,
        icoActive: Boolean(data.settings?.billing_ico && data.settings.ico_activated_at),
        goals: data.goals,
        workSettings: data.workSettings,
        activeTrips: premium.household ? activeTrips(data, todayISO()) : [],
        premium: premium.household,
        isAdmin: premium.isAdmin,
        hiddenSections: prefs.hidden_sections,
        profile: prefs.profile,
        locale: prefs.locale,
      }}
    >
      <Shell email={ctx.user.email} household={ctx.household} households={ctx.households} mode={ctx.store.mode}>
        {children}
        {!premium.household && !prefs.promo_seen_at && !ctx.household.is_demo && <PremiumPromo />}
      </Shell>
    </LookupsProvider>
  );
}

/** Cesty, ke kterým má smysl rychle zapisovat výdaje: probíhající a začínající do 3 dnů. */
function activeTrips(data: Awaited<ReturnType<typeof loadData>>, today: string) {
  return data.travel.trips
    .filter((t) => t.start_date && t.start_date <= addDays(today, 3) && (t.end_date ?? t.start_date) >= addDays(today, -1))
    .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))
    .map((trip) => ({
      trip,
      people: data.travel.people.filter((p) => p.trip_id === trip.id),
      wallets: wallets(data.travel.cash.filter((c) => c.trip_id === trip.id), data.travel.expenses.filter((e) => e.trip_id === trip.id)),
    }));
}
