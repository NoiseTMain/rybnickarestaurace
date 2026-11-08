"use client";
import { useActionState } from "react";
import { requestPasswordReset, signIn, signUp } from "@/lib/actions/auth";
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

export function RegisterForm() {
  const [state, action, pending] = useActionState(signUp, initialResult);
  const { t } = useT();
  if (state.ok && state.message) return <p className="rounded-xl bg-gold/10 px-4 py-3 text-sm text-gold-bright">{state.message}</p>;
  return (
    <form action={action} className="space-y-4">
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
