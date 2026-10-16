"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError("");
    const { error } = await getBrowserClient().auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    if (error) {
      setLoading(false);
      setError(
        error.message.includes("Invalid login credentials")
          ? "Nesprávný e-mail nebo heslo."
          : error.status === 429
            ? "Příliš mnoho pokusů. Zkuste to za chvíli."
            : `Přihlášení se nezdařilo: ${error.message}`,
      );
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-6">
      <div>
        <label htmlFor="email" className="field-label">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="username" className="field" />
      </div>
      <div>
        <label htmlFor="password" className="field-label">Heslo</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</p>}
      <button type="submit" className="btn btn-dark w-full" disabled={loading}>
        {loading ? "Přihlašuji…" : "Přihlásit se"}
      </button>
      <p className="text-center text-sm">
        <Link href="/admin/obnova-hesla" className="text-pond-700 underline underline-offset-2">Zapomenuté heslo</Link>
      </p>
    </form>
  );
}
