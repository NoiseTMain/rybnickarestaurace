"use client";
import { Paperclip, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useLookups } from "@/components/Lookups";
import { Label } from "@/components/ui/Field";
import { uploadDocument } from "@/lib/upload-client";
import type { DocumentRow } from "@/lib/db/types";
import { Button } from "@/components/ui/Button";

export function AccountOptions({ onlyActive = true, includeEmpty }: { onlyActive?: boolean; includeEmpty?: string }) {
  const { accounts } = useLookups();
  return (
    <>
      {includeEmpty != null && <option value="">{includeEmpty}</option>}
      {accounts.filter((a) => !onlyActive || a.is_active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </>
  );
}

export function CategoryOptions({ kind, includeEmpty = "— bez kategorie —", current }: { kind: "expense" | "income"; includeEmpty?: string | null; current?: string | null }) {
  const { categories } = useLookups();
  return (
    <>
      {includeEmpty != null && <option value="">{includeEmpty}</option>}
      {categories.filter((c) => c.kind === kind && (!c.is_archived || c.id === current)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </>
  );
}

export function MemberOptions({ includeEmpty = "— nikdo konkrétní —" }: { includeEmpty?: string }) {
  const { members } = useLookups();
  return (
    <>
      <option value="">{includeEmpty}</option>
      {members.filter((m) => m.is_active).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </>
  );
}

/** Přiložení souboru (účtenka, faktura) – nahraje se hned a do formuláře se vloží id dokumentu. */
export function AttachDocument({ name = "document_id", kind, initialId, label = "Příloha (účtenka)", onFile }: { name?: string; kind: DocumentRow["kind"]; initialId?: string | null; label?: string; onFile?: (f: File, id: string) => void }) {
  const lk = useLookups();
  const [docId, setDocId] = useState<string | null>(initialId ?? null);
  const [fileName, setFileName] = useState<string | null>(initialId ? "Přiložený dokument" : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Label>{label}</Label>
      <input type="hidden" name={name} value={docId ?? ""} />
      {docId ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
          <Paperclip className="h-4 w-4 text-gold" />
          <a href={`/api/files/${docId}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate underline-offset-2 hover:underline">{fileName}</a>
          <Button type="button" variant="ghost" size="icon" onClick={() => { setDocId(null); setFileName(null); }} aria-label="Odebrat přílohu"><X className="h-4 w-4" /></Button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-sm text-ink-2 hover:border-gold/50 hover:text-ink">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          <span>{busy ? "Nahrávám…" : "Vyfotit nebo vybrat soubor (PDF, JPG, PNG)"}</span>
          <input
            type="file"
            accept="application/pdf,image/*"
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              setError(null);
              try {
                const id = await uploadDocument(f, kind, lk);
                setDocId(id);
                setFileName(f.name);
                onFile?.(f, id);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Nahrání selhalo");
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-neg">{error}</p>}
    </div>
  );
}

export function FormActions({ pending, submitLabel = "Uložit", onCancel }: { pending: boolean; submitLabel?: string; onCancel?: () => void }) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-2 flex justify-end gap-2 border-t border-white/[0.06] bg-[#141414]/90 px-5 pt-3 backdrop-blur">
      {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Zrušit</Button>}
      <Button type="submit" variant="primary" loading={pending}>{submitLabel}</Button>
    </div>
  );
}
