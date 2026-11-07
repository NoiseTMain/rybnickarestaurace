"use client";
import { BadgeCheck, Building2, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { activateIco, checkIco } from "@/lib/actions/ico";
import type { IcoInfo } from "@/lib/db/types";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { FormError, Input, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { Badge } from "@/components/ui/Badge";

export function IcoInfoCard({ info }: { info: IcoInfo }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{info.name ?? "Název neuveden"}</p>
          <p className="text-ink-2">IČO {info.ico}{info.dic && ` · DIČ ${info.dic}`}</p>
          {info.address && <p className="text-ink-2">{info.address}</p>}
          <p className="mt-1 text-xs text-ink-3">{[info.legalForm, info.established && `vznik ${formatDate(info.established)}`].filter(Boolean).join(" · ")}</p>
        </div>
        {info.verified ? <Badge tone="positive"><BadgeCheck className="h-3 w-3" />ověřeno v ARES</Badge> : <Badge tone="warning">neověřeno</Badge>}
      </div>
    </div>
  );
}

/** Aktivace / změna IČO s ověřením v registru ARES a potvrzením heslem. */
export function IcoForm({ current, nextChange }: { current: string | null; nextChange: string | null }) {
  const [ico, setIco] = useState(current ?? "");
  const [preview, setPreview] = useState<{ info?: IcoInfo; error?: string; ceased?: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [password, setPassword] = useState("");
  const { state, formAction, pending, fe } = useFormAction(activateIco, () => setPreview(null));
  const blocked = Boolean(current && nextChange);
  const aresDown = Boolean(preview?.error && /ARES (je nedostupný|teď neodpovídá)|Registr ARES/.test(preview.error));
  if (blocked) return <p className="text-sm text-ink-3">Další změna IČO bude možná {formatDate(nextChange)} (nejvýše jednou za 30 dní).</p>;
  return (
    <form action={formAction} className="space-y-3">
      <div className="flex items-end gap-2">
        <Input name="ico" label={current ? "Nové IČO" : "IČO"} inputMode="numeric" maxLength={10} value={ico} onChange={(e) => { setIco(e.target.value); setPreview(null); }} error={fe("ico")} className="flex-1" />
        <Button type="button" icon={checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} disabled={ico.replace(/\s/g, "").length !== 8 || checking}
          onClick={async () => { setChecking(true); setPreview(await checkIco(ico)); setChecking(false); }}>Ověřit</Button>
      </div>
      {preview?.info && <IcoInfoCard info={preview.info} />}
      {preview?.ceased && <p className="text-sm text-warn">Pozor: subjekt má v ARES uvedené datum zániku.</p>}
      {preview?.error && <p className="text-sm text-neg">{preview.error}</p>}
      {(preview?.info || state.error || aresDown) && (
        <>
          <Input name="password" type="password" label="Potvrďte heslem" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fe("password")} />
          {(aresDown || state.error?.includes("ARES")) && <Toggle name="manual" label="Registr nedostupný – uložit zatím bez ověření" />}
          <p className="text-xs text-ink-3">{current ? "IČO půjde znovu změnit až za 30 dní." : "Po aktivaci se zpřístupní obsah sekcí Faktury a Práce."}</p>
          <FormError error={state.ok ? undefined : state.error} />
          <Button type="submit" variant="primary" loading={pending}>{current ? "Změnit IČO" : "Aktivovat IČO"}</Button>
        </>
      )}
    </form>
  );
}
