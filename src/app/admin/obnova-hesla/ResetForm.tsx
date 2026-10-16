"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * 1) Bez relace: odešle odkaz pro obnovu hesla na e-mail.
 * 2) Po kliknutí na odkaz (relace z /auth/confirm): nastaví nové heslo.
 */
export function ResetForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"loading" | "request" | "set">("loading");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBrowserClient()
      .auth.getUser()
      .then(({ data }) => setMode(data.user ? "set" : "request"));
  }, []);

  async function requestLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    const { error } = await getBrowserClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/admin/obnova-hesla`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setMessage("Pokud účet existuje, poslali jsme na e-mail odkaz pro nastavení nového hesla.");
  }

  async function setPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 10) return setError("Heslo musí mít alespoň 10 znaků.");
    if (password !== String(form.get("password2"))) return setError("Hesla se neshodují.");
    setBusy(true);
    setError("");
    const { error } = await getBrowserClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace("/admin");
    router.refresh();
  }

  if (mode === "loading") return <p className="text-center text-ink-soft">Načítám…</p>;

  if (mode === "set") {
    return (
      <form onSubmit={setPassword} className="card space-y-5 p-6">
        <div>
          <label htmlFor="password" className="field-label">Nové heslo</label>
          <input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" className="field" />
        </div>
        <div>
          <label htmlFor="password2" className="field-label">Nové heslo znovu</label>
          <input id="password2" name="password2" type="password" minLength={10} required autoComplete="new-password" className="field" />
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <button className="btn btn-dark w-full" disabled={busy}>{busy ? "Ukládám…" : "Uložit heslo"}</button>
      </form>
    );
  }

  return (
    <form onSubmit={requestLink} className="card space-y-5 p-6">
      {message ? (
        <p role="status" className="rounded-lg bg-pond-50 px-3 py-2 text-sm text-pond-900">{message}</p>
      ) : (
        <>
          <div>
            <label htmlFor="email" className="field-label">E-mail účtu</label>
            <input id="email" name="email" type="email" required autoComplete="username" className="field" />
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          <button className="btn btn-dark w-full" disabled={busy}>{busy ? "Odesílám…" : "Poslat odkaz"}</button>
        </>
      )}
      <p className="text-center text-sm">
        <Link href="/admin/prihlaseni" className="text-pond-700 underline underline-offset-2">Zpět na přihlášení</Link>
      </p>
    </form>
  );
}
