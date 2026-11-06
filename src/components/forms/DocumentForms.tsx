"use client";
import { Pencil, Upload, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateDocument } from "@/lib/actions/documents";
import type { DocumentRow } from "@/lib/db/types";
import { DOCUMENT_KIND_LABEL } from "@/lib/defaults";
import { uploadDocument } from "@/lib/upload-client";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, Select } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { useToast } from "@/components/ui/Toast";
import { FormActions } from "./common";

export function UploadDocumentButton() {
  const lk = useLookups();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<DocumentRow["kind"]>("other");
  return (
    <div className="flex items-center gap-2">
      <select aria-label="Druh dokumentu" className="field !w-auto !py-2 !text-sm" value={kind} onChange={(e) => setKind(e.target.value as DocumentRow["kind"])}>
        {Object.entries(DOCUMENT_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold px-4 text-sm font-medium text-[#1b1407]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Nahrát
        <input type="file" multiple accept="application/pdf,image/*" className="sr-only" disabled={busy} onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          setBusy(true);
          let ok = 0;
          for (const f of files) {
            try { await uploadDocument(f, kind, lk); ok++; } catch (err) { toast(`${f.name}: ${err instanceof Error ? err.message : "chyba"}`, "error"); }
          }
          setBusy(false);
          e.target.value = "";
          if (ok) { toast(`Nahráno ${ok} ${ok === 1 ? "dokument" : "dokumentů"}`); router.refresh(); }
        }} />
      </label>
    </div>
  );
}

function EditForm({ doc, onDone }: { doc: DocumentRow; onDone: () => void }) {
  const { state, formAction, pending, fe } = useFormAction(updateDocument, onDone);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={doc.id} />
      <Input name="title" label="Název" defaultValue={doc.title} error={fe("title")} required />
      <Select name="kind" label="Druh" defaultValue={doc.kind}>{Object.entries(DOCUMENT_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
      <Input name="tags" label="Štítky" hint="pro vyhledávání" placeholder="např. auto, záruka, 2026" defaultValue={doc.tags ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}

export function EditDocumentButton({ doc }: { doc: DocumentRow }) {
  return <ModalButton size="icon" variant="ghost" icon={<Pencil className="h-4 w-4" />} title="Upravit dokument" render={(close) => <EditForm doc={doc} onDone={close} />} />;
}
