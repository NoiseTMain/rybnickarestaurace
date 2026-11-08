import "server-only";

const seen = new Map<string, number>();

/** Zapíše chybu aplikace (bez finančních dat) – pro přehled v administraci. Nikdy nevyhodí. */
export async function logAppError(input: { message: string; stack?: string | null; path?: string | null; digest?: string | null; userAgent?: string | null; userId?: string | null }) {
  try {
    const message = String(input.message || "Neznámá chyba").slice(0, 500);
    // jednoduchý limit: stejná zpráva max 1× za minutu na instanci
    const key = `${message}|${input.path ?? ""}`;
    const now = Date.now();
    if ((seen.get(key) ?? 0) > now - 60_000) return;
    seen.set(key, now);
    if (seen.size > 500) seen.clear();
    const { adminBackend, adminConfigured } = await import("@/lib/admin");
    if (!adminConfigured()) return;
    const b = await adminBackend();
    await b.logError({
      user_id: input.userId ?? null,
      path: input.path ? String(input.path).slice(0, 300) : null,
      message,
      stack: input.stack ? String(input.stack).slice(0, 4000) : null,
      digest: input.digest ? String(input.digest).slice(0, 100) : null,
      user_agent: input.userAgent ? String(input.userAgent).slice(0, 300) : null,
    });
  } catch {
    /* logování chyb nesmí shodit aplikaci */
  }
}
