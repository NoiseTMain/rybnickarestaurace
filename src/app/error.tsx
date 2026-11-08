"use client";
import Link from "next/link";
import { useEffect } from "react";
import { reportError } from "@/components/ErrorReporter";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(error.message || "Chyba stránky", error.stack, error.digest); }, [error]);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-4xl">😕</p>
      <h1 className="text-xl font-semibold">Něco se pokazilo</h1>
      <p className="text-sm text-ink-2">Chybu jsme zaznamenali a podíváme se na ni. Vaše data jsou v pořádku.</p>
      <div className="flex gap-2">
        <button onClick={reset} className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-black">Zkusit znovu</button>
        <Link href="/" className="rounded-xl border border-white/10 px-4 py-2 text-sm">Na přehled</Link>
      </div>
    </div>
  );
}
