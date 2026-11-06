"use client";
import { Camera, Link2, Loader2, Pencil, Plus, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { fetchProductPreview, markBought, savePurchase } from "@/lib/actions/purchases";
import { uploadDocument } from "@/lib/upload-client";
import { Button } from "@/components/ui/Button";
import { toInputValue } from "@/lib/money";
import type { Purchase } from "@/lib/db/types";
import { PURCHASE_STATUS_LABEL } from "@/lib/defaults";
import { useLookups } from "@/components/Lookups";
import { FormError, Input, MoneyInput, Select, Textarea, Toggle } from "@/components/ui/Field";
import { useFormAction } from "@/components/ui/useFormAction";
import { ModalButton } from "@/components/ui/ModalButton";
import { AccountOptions, CategoryOptions, FormActions } from "./common";

export const ROOMS = ["Obývací pokoj", "Ložnice", "Kuchyně", "Koupelna", "Dětský pokoj", "Pracovna", "Předsíň", "Balkon a zahrada", "Celý byt"];

/** Fotka produktu: nahrání z mobilu/počítače, nebo automaticky z odkazu na e-shop. */
function ProductPhoto({ docId, setDocId, url, setUrl, onPreview, error }: {
  docId: string | null; setDocId: (v: string | null) => void; url: string; setUrl: (v: string) => void;
  onPreview: (p: { title: string | null; price: number | null }) => void; error?: string;
}) {
  const lk = useLookups();
  const [busy, setBusy] = useState<"upload" | "link" | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  return (
    <div className="space-y-3">
      <input type="hidden" name="image_document_id" value={docId ?? ""} />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        {docId ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/files/${docId}`} alt="Fotka produktu" className="aspect-[4/3] w-full bg-white object-contain" />
            <button type="button" onClick={() => setDocId(null)} className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-ink hover:bg-black" aria-label="Odebrat fotku"><X className="h-4 w-4" /></button>
          </>
        ) : (
          <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 text-sm text-ink-2 hover:text-ink">
            {busy === "upload" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6 text-gold" />}
            <span>{busy === "upload" ? "Nahrávám…" : "Vyfotit nebo nahrát fotku"}</span>
            <input type="file" accept="image/*" className="sr-only" disabled={busy != null} onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy("upload");
              setMsg(null);
              try { setDocId(await uploadDocument(f, "other", lk, "Fotka produktu")); } catch (err) { setMsg({ text: err instanceof Error ? err.message : "Nahrání selhalo", tone: "err" }); }
              setBusy(null);
              e.target.value = "";
            }} />
          </label>
        )}
      </div>
      <div className="flex items-end gap-2">
        <Input name="url" type="url" label="Odkaz na produkt" placeholder="https://www.ikea.com/cz/…" value={url} onChange={(e) => setUrl(e.target.value)} error={error} className="flex-1" />
        <Button type="button" icon={busy === "link" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} disabled={!/^https?:\/\//i.test(url) || busy != null} onClick={async () => {
          setBusy("link");
          setMsg(null);
          const r = await fetchProductPreview(url);
          setBusy(null);
          if (!r.ok || !r.preview) return setMsg({ text: r.error ?? "Odkaz se nepodařilo načíst", tone: "err" });
          if (r.preview.documentId) setDocId(r.preview.documentId);
          onPreview(r.preview);
          setMsg({ text: r.message ?? "Načteno", tone: r.preview.documentId ? "ok" : "err" });
        }}>Načíst</Button>
      </div>
      {msg && <p className={`text-xs ${msg.tone === "ok" ? "text-pos" : "text-warn"}`}>{msg.text}</p>}
    </div>
  );
}

export function PurchaseForm({ initial, onDone, kind = "general" }: { initial?: Purchase; onDone?: () => void; kind?: Purchase["kind"] }) {
  const { state, formAction, pending, fe } = useFormAction(savePurchase, onDone);
  const k = initial?.kind ?? kind;
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(toInputValue(initial?.price));
  const [docId, setDocId] = useState<string | null>(initial?.image_document_id ?? null);
  const [url, setUrl] = useState(initial?.url ?? "");
  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="kind" value={k} />
      <ProductPhoto docId={docId} setDocId={setDocId} url={url} setUrl={setUrl} error={fe("url")}
        onPreview={(p) => { if (!name && p.title) setName(p.title); if (!price && p.price) setPrice(toInputValue(p.price)); }} />
      <Input name="name" label={k === "home" ? "Co (např. sedačka, komoda)" : "Co chci koupit"} value={name} onChange={(e) => setName(e.target.value)} error={fe("name")} required />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="price" label="Cena" value={price} onChange={(e) => setPrice(e.target.value)} error={fe("price")} required />
        <Select name="priority" label="Priorita" defaultValue={String(initial?.priority ?? 3)}>
          {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>{p === 1 ? "1 – nutné" : p === 5 ? "5 – jednou možná" : p}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select name="status" label="Stav" defaultValue={initial?.status ?? "planned"}>
          {Object.entries(PURCHASE_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Input name="planned_date" type="date" label="Plánované datum" defaultValue={initial?.planned_date ?? ""} error={fe("planned_date")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Input name="room" label="Místnost" list="homeos-rooms" placeholder={k === "home" ? "např. Obývací pokoj" : "nepovinné"} defaultValue={initial?.room ?? ""} error={fe("room")} />
          <datalist id="homeos-rooms">{ROOMS.map((r) => <option key={r} value={r} />)}</datalist>
        </div>
        <Select name="category_id" label="Kategorie" defaultValue={initial?.category_id ?? ""}><CategoryOptions kind="expense" current={initial?.category_id} /></Select>
      </div>
      <Toggle name="is_wish" label="Seznam přání" description="Není nutné, jen by se líbilo" defaultChecked={initial?.is_wish} />
      <Textarea name="note" label="Poznámka" defaultValue={initial?.note ?? ""} />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}

export function PurchaseButton({ initial, label, variant = "secondary", size = "sm", kind = "general" }: { initial?: Purchase; label?: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "icon"; kind?: Purchase["kind"] }) {
  const k = initial?.kind ?? kind;
  return <ModalButton label={label} variant={variant} size={size} icon={initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} title={initial ? "Upravit nákup" : k === "home" ? "Nábytek a vybavení" : "Nový nákup"} render={(close) => <PurchaseForm initial={initial} kind={k} onDone={close} />} />;
}

export function BoughtButton({ purchase }: { purchase: Purchase }) {
  return <ModalButton label="Koupeno" size="sm" variant="secondary" icon={<ShoppingBag className="h-4 w-4" />} title={`Koupeno: ${purchase.name}`} render={(close) => <BoughtForm purchase={purchase} onDone={close} />} />;
}

function BoughtForm({ purchase, onDone }: { purchase: Purchase; onDone: () => void }) {
  const lk = useLookups();
  const { state, formAction, pending, fe } = useFormAction(markBought, onDone);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={purchase.id} />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="amount" label="Skutečná cena" defaultValue={toInputValue(purchase.price || null)} error={fe("amount")} required />
        <Input name="date" type="date" label="Datum" defaultValue={lk.today} error={fe("date")} required />
      </div>
      <Select name="account_id" label="Zaplaceno z účtu" defaultValue={lk.accounts.find((a) => a.include_in_available)?.id} error={fe("account_id")}><AccountOptions /></Select>
      <Toggle name="create_transaction" label="Zapsat jako výdaj" description="Vypněte, pokud výdaj už máte zapsaný" defaultChecked />
      <FormError error={state.ok ? undefined : state.error} />
      <FormActions pending={pending} onCancel={onDone} submitLabel="Potvrdit" />
    </form>
  );
}
