"use client";
import { useActionState, useState, useTransition } from "react";
import { requestPasswordReset, signIn, signInWithProvider, signUp } from "@/lib/actions/auth";
import { initialResult } from "@/lib/actions/result";
import { Button } from "@/components/ui/Button";
import { FormError, Input } from "@/components/ui/Field";
import { useT } from "@/components/I18n";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialResult);
  const { t } = useT();
  return (
    <form action={action} className="space-y-4">
      <Input name="email" type="email" label={t("auth.email")} autoComplete="email" required error={state.fieldErrors?.email} />
      <Input name="password" type="password" label={t("auth.password")} autoComplete="current-password" required error={state.fieldErrors?.password} />
      <FormError error={state.ok ? undefined : state.error} />
      <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={pending}>{t("auth.signIn")}</Button>
    </form>
  );
}

export function RegisterForm({ referral }: { referral?: string }) {
  const [state, action, pending] = useActionState(signUp, initialResult);
  const { t } = useT();
  if (state.ok && state.message) return <p className="rounded-xl bg-gold/10 px-4 py-3 text-sm text-gold-bright">{state.message}</p>;
  return (
    <form action={action} className="space-y-4">
      {referral && <><input type="hidden" name="ref" value={referral} /><p className="rounded-xl bg-gold/10 px-3 py-2 text-xs text-gold-bright">🎁 Registrujete se přes doporučení – po týdnu používání dostanete vy i kamarád měsíc Premium zdarma.</p></>}
      <Input name="email" type="email" label={t("auth.email")} autoComplete="email" required error={state.fieldErrors?.email} />
      <Input name="password" type="password" label={t("auth.password")} hint={t("auth.min8")} autoComplete="new-password" required minLength={8} error={state.fieldErrors?.password} />
      <Input name="password2" type="password" label={t("auth.password2")} autoComplete="new-password" required error={state.fieldErrors?.password2} />
      <label className="flex items-start gap-2 text-xs text-ink-2">
        <input type="checkbox" name="terms" className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" required />
        <span>{t("auth.terms1")} <a href="/podminky" target="_blank" className="text-gold underline">{t("auth.terms2")}</a> {t("auth.terms3")} <a href="/soukromi" target="_blank" className="text-gold underline">{t("auth.terms4")}</a>.</span>
      </label>
      {state.fieldErrors?.terms && <p className="text-xs text-neg">{state.fieldErrors.terms}</p>}
      <FormError error={state.ok ? undefined : state.error} />
      <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={pending}>{t("auth.create")}</Button>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialResult);
  if (state.ok && state.message) return <p className="rounded-xl bg-gold/10 px-4 py-3 text-sm text-gold-bright">{state.message}</p>;
  return (
    <form action={action} className="space-y-4">
      <Input name="email" type="email" label="E-mail" autoComplete="email" required error={state.fieldErrors?.email} />
      <FormError error={state.ok ? undefined : state.error} />
      <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={pending}>Poslat odkaz</Button>
    </form>
  );
}

const GoogleIcon = () => <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.8H12z"/></svg>;
const AppleIcon = () => <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.2 1-4 2.5-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.4-1-2.4-4zM14 5.4c.7-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.9-1 2.9 1.1.1 2.1-.5 2.8-1.3z"/></svg>;

/** Tlačítka „Pokračovat přes Google / Apple“ (jen když jsou na serveru zapnutá). */
export function OAuthButtons({ providers }: { providers: ("google" | "apple")[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!providers.length) return null;
  const go = (p: "google" | "apple") => start(async () => { const r = await signInWithProvider(p); if (r?.error) setError(r.error); });
  return (
    <div className="mt-5 space-y-2">
      <div className="flex items-center gap-3 text-xs text-ink-3"><span className="h-px flex-1 bg-white/10" />nebo<span className="h-px flex-1 bg-white/10" /></div>
      {providers.includes("google") && <button type="button" disabled={pending} onClick={() => go("google")} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-medium text-[#1f1f1f] disabled:opacity-60"><GoogleIcon />Pokračovat přes Google</button>}
      {providers.includes("apple") && <button type="button" disabled={pending} onClick={() => go("apple")} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-medium text-white ring-1 ring-white/20 disabled:opacity-60"><AppleIcon />Pokračovat přes Apple</button>}
      <p className="text-center text-[11px] text-ink-3">Pokračováním souhlasíte s <a href="/podminky" className="underline">podmínkami</a> a <a href="/soukromi" className="underline">zásadami ochrany osobních údajů</a>.</p>
      <FormError error={error ?? undefined} />
    </div>
  );
}
