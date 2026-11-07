import { redirect } from "next/navigation";
import { requireContext } from "@/lib/context";
import { loadData } from "@/lib/data";
import { todayISO } from "@/lib/dates";
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
      }}
    >
      <Shell email={ctx.user.email} household={ctx.household} households={ctx.households} mode={ctx.store.mode}>
        {children}
      </Shell>
    </LookupsProvider>
  );
}
