import type { Instrumentation } from "next";

/** Serverové chyby při vykreslování stránek a akcí → přehled chyb v administraci. */
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const e = err as Error & { digest?: string };
  if (String(e.digest ?? "").startsWith("NEXT_")) return;
  const { logAppError } = await import("@/lib/errors-log");
  await logAppError({ message: e.message, stack: e.stack, digest: e.digest, path: request.path, userAgent: String(request.headers["user-agent"] ?? "") });
};
