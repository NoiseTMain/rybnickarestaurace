"use server";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/context";
import { savePrefs } from "@/lib/prefs";
import type { LifeProfile } from "@/lib/db/types";
import { PROFILE_KEYS, SECTION_KEYS } from "@/lib/profiles";

export async function markPromoSeen(): Promise<void> {
  const ctx = await requireContext();
  await savePrefs(ctx.store, ctx.user, { promo_seen_at: new Date().toISOString() });
}

export async function saveProfile(profile: LifeProfile | null, hidden: string[]): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext();
  if (profile && !PROFILE_KEYS.includes(profile)) return { ok: false, error: "Neplatná volba" };
  const clean = [...new Set(hidden.filter((h) => SECTION_KEYS.includes(h)))];
  await savePrefs(ctx.store, ctx.user, { profile, hidden_sections: clean });
  revalidatePath("/", "layout");
  return { ok: true };
}
