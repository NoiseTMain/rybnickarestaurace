"use client";
import { useActionState } from "react";
import { requestPasswordReset, signIn, signUp } from "@/lib/actions/auth";
import { initialResult } from "@/lib/actions/result";
import { Button } from "@/components/ui/Button";
import { FormError, Input } from "@/components/ui/Field";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialResult);
  return (
    <form action={action} className="space-y-4">
      <Input name="email" type="email" label="E-mail" autoComplete="email" required error={state.fieldErrors?.email} />
      <Input name="password" type="password" label="Heslo" autoComplete="current-password" required error={state.fieldErrors?.password} />
      <FormError error={state.ok ? undefined : state.error} />
      <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={pending}>Přihlásit se</Button>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(signUp, initialResult);
  if (state.ok && state.message) return <p className="rounded-xl bg-gold/10 px-4 py-3 text-sm text-gold-bright">{state.message}</p>;
  return (
    <form action={action} className="space-y-4">
      <Input name="email" type="email" label="E-mail" autoComplete="email" required error={state.fieldErrors?.email} />
      <Input name="password" type="password" label="Heslo" hint="min. 8 znaků" autoComplete="new-password" required minLength={8} error={state.fieldErrors?.password} />
      <Input name="password2" type="password" label="Heslo znovu" autoComplete="new-password" required error={state.fieldErrors?.password2} />
      <FormError error={state.ok ? undefined : state.error} />
      <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={pending}>Vytvořit účet</Button>
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
