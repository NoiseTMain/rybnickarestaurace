import { redirect } from "next/navigation";
import { requireUser } from "@/lib/context";
import { todayISO } from "@/lib/dates";
import { localModeBlocked } from "@/lib/env";
import { Onboarding } from "./Onboarding";

export const metadata = { title: "Úvodní nastavení" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (localModeBlocked()) redirect("/konfigurace");
  const { user, store } = await requireUser();
  const memberships = await store.select("household_users", { user_id: user.id });
  const households = (await store.select("households")).filter((h) => memberships.some((m) => m.household_id === h.id));
  return <Onboarding today={todayISO()} email={user.email} hasHousehold={households.some((h) => !h.is_demo)} hasAny={households.length > 0} />;
}
