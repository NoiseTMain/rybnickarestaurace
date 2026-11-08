import "server-only";
import { cache } from "react";
import type { AppUser } from "@/lib/auth";
import type { Store } from "@/lib/db/store";
import type { UserPrefs } from "@/lib/db/types";

export const DEFAULT_PREFS: Omit<UserPrefs, "user_id" | "created_at" | "updated_at"> = { profile: null, hidden_sections: [], locale: "cs", promo_seen_at: null };

/** Předvolby přihlášeného uživatele (výchozí, když ještě nejsou uložené). */
export const getPrefs = cache(async (store: Store, user: AppUser): Promise<UserPrefs> => {
  const row = (await store.select("user_prefs", { user_id: user.id }).catch(() => []))[0];
  return row ? { ...row, hidden_sections: row.hidden_sections ?? [] } : { ...DEFAULT_PREFS, user_id: user.id, created_at: "", updated_at: "" };
});

export async function savePrefs(store: Store, user: AppUser, patch: Partial<Omit<UserPrefs, "user_id" | "created_at" | "updated_at">>) {
  const exists = (await store.select("user_prefs", { user_id: user.id }))[0];
  if (exists) await store.update("user_prefs", { user_id: user.id } as never, patch as never);
  else await store.insert("user_prefs", [{ ...DEFAULT_PREFS, ...patch, user_id: user.id } as never]);
}
