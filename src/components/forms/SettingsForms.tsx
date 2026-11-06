"use client";
import { Check, Copy, FlaskConical, Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite, createDemoHousehold, createInvite, deleteHousehold, renameHousehold, saveSetting } from "@/lib/actions/household";
import { restoreFromBackup } from "@/lib/actions/backup";
import { changePassword } from "@/lib/actions/auth";
import { parseMoney, toInputValue } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { FormError, Input, MoneyInput, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { useToast } from "@/components/ui/Toast";

/** Pole nastavení, které se samo uloží po opuštění (automatické ukládání). */
export function AutosaveField({ field, label, initial, type = "text", hint }: { field: string; label: string; initial: string | number | null; type?: "text" | "money" | "number"; hint?: string }) {
  const start = type === "money" ? toInputValue((initial as number) ?? 0) : initial == null ? "" : String(initial);
  const [value, setValue] = useState(start);
  const [saved, setSaved] = useState(start);
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [error, setError] = useState<string>();
  const [, startT] = useTransition();
  const save = () => {
    if (value === saved) return;
    if (type === "money" && parseMoney(value || "0") == null) { setStatus("error"); setError("Neplatná částka"); return; }
    setStatus("saving");
    startT(async () => {
      const r = await saveSetting(field, type === "money" ? value || "0" : value);
      if (r.ok) { setSaved(value); setStatus("ok"); setError(undefined); setTimeout(() => setStatus("idle"), 1500); }
      else { setStatus("error"); setError(r.error); }
    });
  };
  const indicator = status === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : status === "ok" ? <span className="flex items-center gap-1 text-pos"><Check className="h-3 w-3" />uloženo</span> : hint;
  const common = { label, value, hint: indicator as string, error, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value), onBlur: save, onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && (e.target as HTMLInputElement).blur() };
  return type === "money" ? <MoneyInput {...common} /> : <Input {...common} inputMode={type === "number" ? "numeric" : undefined} />;
}

export function AutosaveToggle({ field, label, description, initial }: { field: string; label: string; description?: string; initial: boolean }) {
  const [v, setV] = useState(initial);
  const toast = useToast();
  return <Toggle label={label} description={description} checked={v} onChange={async (e) => { const n = e.target.checked; setV(n); const r = await saveSetting(field, n); if (!r.ok) { setV(!n); toast(r.error ?? "Chyba", "error"); } }} />;
}

export function RenameHousehold({ name }: { name: string }) {
  const { state, formAction, pending, fe } = useFormAction(renameHousehold);
  return (
    <form action={formAction} className="flex items-end gap-2">
      <Input name="name" label="Název domácnosti" defaultValue={name} error={fe("name")} className="flex-1" />
      <Button type="submit" loading={pending}>Uložit</Button>
      <FormError error={state.ok ? undefined : state.error} />
    </form>
  );
}

export function InviteBox() {
  const [code, setCode] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-2">Partner(ka) si vytvoří vlastní účet a v úvodním nastavení zadá kód. Kód platí 7 dní a jen jednou.</p>
      {code ? (
        <div className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2">
          <code className="num flex-1 text-lg tracking-widest text-gold-bright">{code}</code>
          <Button size="sm" variant="ghost" icon={<Copy className="h-4 w-4" />} onClick={() => { navigator.clipboard?.writeText(code); toast("Zkopírováno"); }}>Kopírovat</Button>
        </div>
      ) : (
        <Button loading={pending} onClick={() => start(async () => { const r = await createInvite(); if (r.ok) setCode(r.message!); else toast(r.error ?? "Chyba", "error"); })}>Vytvořit pozvánku</Button>
      )}
    </div>
  );
}

export function DeleteHouseholdForm({ id, name, isDemo }: { id: string; name: string; isDemo: boolean }) {
  const router = useRouter();
  const { state, formAction, pending, fe } = useFormAction(deleteHousehold, () => router.push("/"));
  const [open, setOpen] = useState(false);
  if (!open) return <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setOpen(true)}>{isDemo ? "Smazat demo" : "Smazat domácnost"}</Button>;
  return (
    <form action={formAction} className="space-y-2 rounded-xl border border-neg/30 bg-neg/10 p-3">
      <input type="hidden" name="id" value={id} />
      {!isDemo && <Input name="confirm" label={`Pro potvrzení opište název „${name}“`} error={fe("confirm")} />}
      <p className="text-xs text-neg">Smažou se všechna data a dokumenty této domácnosti. Nelze vrátit – nejdřív si stáhněte zálohu.</p>
      <FormError error={state.ok ? undefined : state.error} />
      <div className="flex gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Zrušit</Button><Button type="submit" variant="danger" size="sm" loading={pending}>Trvale smazat</Button></div>
    </form>
  );
}

export function CreateDemoButton() {
  const [pending, start] = useTransition();
  return <Button loading={pending} icon={<FlaskConical className="h-4 w-4" />} onClick={() => start(async () => { await createDemoHousehold(); })}>Vytvořit demo domácnost</Button>;
}

export function RestoreForm() {
  const { state, formAction, pending, fe } = useFormAction(restoreFromBackup);
  return (
    <form action={formAction} className="space-y-3">
      <Input name="file" type="file" accept="application/json,.json" label="Soubor zálohy (.json)" error={fe("file")} />
      <Input name="confirm" label="Napište OBNOVIT" placeholder="OBNOVIT" error={fe("confirm")} autoComplete="off" />
      <p className="text-xs text-warn">Obnova NAHRADÍ všechna současná data této domácnosti obsahem zálohy. Při chybě se vrátí původní stav.</p>
      <FormError error={state.ok ? undefined : state.error} />
      <Button type="submit" variant="danger" loading={pending}>Obnovit ze zálohy</Button>
    </form>
  );
}

export function PasswordForm() {
  const { state, formAction, pending, fe } = useFormAction(changePassword);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Input name="password" type="password" label="Nové heslo" autoComplete="new-password" error={fe("password")} className="min-w-56 flex-1" />
      <Button type="submit" loading={pending}>Změnit heslo</Button>
      <FormError error={state.ok ? undefined : state.error} />
    </form>
  );
}

/** Připojení k jiné domácnosti pomocí kódu pozvánky. */
export function JoinHouseholdForm() {
  const { state, formAction, pending, fe } = useFormAction(acceptInvite);
  return (
    <form action={formAction} className="space-y-2">
      <p className="text-sm text-ink-2">Máte kód od jiné domácnosti? Po připojení uvidíte její finance a vlastník vás uvidí mezi členy.</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Input name="code" label="Kód pozvánky" placeholder="např. K3J9QW2XAB7P" autoComplete="off" className="[&_input]:uppercase" error={fe("code")} required />
        <Input name="member_name" label="Vaše jméno v domácnosti" placeholder="nepovinné" />
        <Button type="submit" variant="primary" loading={pending}>Přidat se do domácnosti</Button>
      </div>
      <FormError error={state.ok ? undefined : state.error} />
    </form>
  );
}
