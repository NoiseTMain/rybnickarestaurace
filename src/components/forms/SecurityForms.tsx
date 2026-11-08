"use client";
import { KeyRound, LogOut, ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { confirmMfa, disableMfa, mfaStatus, signOutEverywhere, startMfa, verifyLoginCode } from "@/lib/actions/security";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { FormError, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export function MfaLoginForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await verifyLoginCode(code); if (r.ok) router.replace("/"); else setError(r.error ?? "Nesprávný kód"); }); }}>
        <Input label="Kód" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} autoFocus required />
        <FormError error={error ?? undefined} />
        <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={pending}>Ověřit</Button>
      </form>
      <form action={signOut}><button className="w-full text-center text-sm text-ink-3 hover:text-ink">Přihlásit se jiným účtem</button></form>
    </div>
  );
}

/** Nastavení zabezpečení: 2FA a odhlášení ze všech zařízení. */
export function SecurityCard() {
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => { void mfaStatus().then((s) => setEnabled(s.enabled)); }, []);
  if (enabled === null) return <p className="text-sm text-ink-3">Načítám…</p>;
  return (
    <div className="space-y-4">
      {enabled ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-pos"><ShieldCheck className="h-4 w-4" />Dvoufázové ověření je zapnuté – při přihlášení zadáte i kód z aplikace.</p>
          <div className="flex flex-wrap items-end gap-2">
            <Input label="Heslo pro vypnutí" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="min-w-0 flex-1" />
            <Button variant="ghost" loading={pending} icon={<ShieldOff className="h-4 w-4" />} onClick={() => start(async () => { const r = await disableMfa(pw); if (r.ok) { setEnabled(false); setPw(""); toast("2FA vypnuto"); } else setError(r.error ?? "Chyba"); })}>Vypnout 2FA</Button>
          </div>
        </div>
      ) : setup ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-2">1) Naskenujte QR kód v aplikaci (Google Authenticator, Microsoft Authenticator, 1Password…). 2) Opište 6místný kód.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="QR kód pro ověřovací aplikaci" width={200} height={200} className="rounded-xl bg-white p-2" />
          <p className="text-xs text-ink-3">Nebo zadejte klíč ručně: <code className="select-all break-all" data-testid="totp-secret">{setup.secret}</code></p>
          <div className="flex flex-wrap items-end gap-2">
            <Input label="Kód z aplikace" inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className="min-w-0 flex-1" />
            <Button variant="primary" loading={pending} onClick={() => start(async () => { const r = await confirmMfa(setup.factorId, code); if (r.ok) { setEnabled(true); setSetup(null); setCode(""); toast("2FA zapnuto"); } else setError(r.error ?? "Chyba"); })}>Potvrdit</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-ink-2">Dvoufázové ověření chrání účet i při úniku hesla: kromě hesla zadáte při přihlášení kód z telefonu.</p>
          <Button variant="secondary" loading={pending} icon={<KeyRound className="h-4 w-4" />} onClick={() => start(async () => { setError(null); const r = await startMfa(); if (r.qr && r.factorId && r.secret) setSetup({ factorId: r.factorId, qr: r.qr, secret: r.secret }); else setError(r.error ?? "Chyba"); })}>Zapnout dvoufázové ověření</Button>
        </div>
      )}
      <FormError error={error ?? undefined} />
      <form action={signOutEverywhere} className="border-t border-white/[0.06] pt-3">
        <p className="mb-2 text-xs text-ink-3">Ztratili jste telefon nebo jste se přihlásili na cizím počítači?</p>
        <Button type="submit" variant="ghost" size="sm" icon={<LogOut className="h-4 w-4" />}>Odhlásit ze všech zařízení</Button>
      </form>
    </div>
  );
}
