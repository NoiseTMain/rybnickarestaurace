import type { Instrumentation } from "next";

/** Jazyk aktuálního požadavku pro překlad při vykreslení (viz lib/i18n/phrase.ts). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [sk, en] = await Promise.all([import("@/lib/i18n/phrases/sk.json"), import("@/lib/i18n/phrases/en.json")]);
  (globalThis as { __homeosDicts?: unknown }).__homeosDicts = { sk: sk.default, en: en.default };
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  (globalThis as { __homeosLocale?: () => string }).__homeosLocale = () => {
    const store = workUnitAsyncStorage.getStore() as { type?: string; cookies?: { get(n: string): { value: string } | undefined }; headers?: { get(n: string): string | null } } | undefined;
    if (!store || store.type !== "request") return "cs";
    const c = store.cookies?.get("homeos_locale")?.value;
    if (c === "cs" || c === "sk" || c === "en") return c;
    return (store.headers?.get("accept-language") ?? "").toLowerCase().split(",")[0]?.trim().startsWith("sk") ? "sk" : "cs";
  };
}

/** Serverové chyby při vykreslování stránek a akcí → přehled chyb v administraci. */
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const e = err as Error & { digest?: string };
  if (String(e.digest ?? "").startsWith("NEXT_")) return;
  const { logAppError } = await import("@/lib/errors-log");
  await logAppError({ message: e.message, stack: e.stack, digest: e.digest, path: request.path, userAgent: String(request.headers["user-agent"] ?? "") });
};
