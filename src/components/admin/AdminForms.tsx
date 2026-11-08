"use client";
import { Ban, Crown, Search, ShieldOff, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { adminGrantPremium, adminRevokePremium, adminSetBanned } from "@/lib/actions/admin";
import { FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { Button } from "@/components/ui/Button";
import { ActionButton } from "@/components/ui/ActionButton";
import { ModalButton } from "@/components/ui/ModalButton";

function GrantForm({ email, onDone }: { email?: string; onDone?: () => void }) {
  const [length, setLength] = useState("1m");
  const { state, formAction, pending, fe } = useFormAction(adminGrantPremium, onDone);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
      <Input name="email" type="email" label="E-mail uživatele" placeholder="jmeno@example.cz" defaultValue={email} readOnly={Boolean(email)} error={fe("email")} required />
      <Select name="length" label="Na jak dlouho" value={length} onChange={(e) => setLength(e.target.value)}>
        <option value="1m">1 měsíc</option><option value="3m">3 měsíce</option><option value="1y">1 rok</option><option value="forever">Napořád</option><option value="date">Do data…</option>
      </Select>
      <Button type="submit" variant="primary" loading={pending} icon={<Crown className="h-4 w-4" />}>Přidat Premium</Button>
      {length === "date" && <Input name="until" type="date" label="Platí do" error={fe("until")} className="sm:col-span-3" />}
      <Textarea name="note" label="Poznámka (jen pro vás)" placeholder="např. tester, kamarád, kompenzace" className="sm:col-span-3" />
      <div className="sm:col-span-3"><FormError error={state.ok ? undefined : state.error} /></div>
    </form>
  );
}

export function AdminGrantForm() {
  return <GrantForm />;
}

export function AdminUserActions({ userId, email, premium, paid, banned, self }: { userId: string; email: string; premium: boolean; paid: boolean; banned: boolean; self: boolean }) {
  return (
    <div className="flex justify-end gap-1">
      {!paid && <ModalButton label={premium ? "Prodloužit" : "Premium"} size="sm" variant="secondary" icon={<Crown className="h-4 w-4" />} title={`Premium pro ${email}`} render={(close) => <GrantForm email={email} onDone={close} />} />}
      {premium && !paid && !self && <ActionButton action={() => adminRevokePremium(userId)} confirm={`Odebrat Premium uživateli ${email}?`} size="sm" icon={<X className="h-4 w-4" />}>Odebrat</ActionButton>}
      {!self && <ActionButton action={() => adminSetBanned(userId, !banned)} confirm={banned ? `Odblokovat ${email}?` : `Zablokovat ${email}? Nebude se moct přihlásit.`} size="icon" icon={banned ? <ShieldOff className="h-4 w-4" /> : <Ban className="h-4 w-4" />} />}
    </div>
  );
}

export function AdminSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initial);
  return (
    <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); const p = new URLSearchParams(params); if (q) p.set("q", q); else p.delete("q"); router.push(`/admin?${p}`); }}>
      <Search className="h-4 w-4 text-ink-3" />
      <input className="field !h-10 min-w-0 flex-1" placeholder="Hledat e-mail…" aria-label="Hledat e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
    </form>
  );
}
