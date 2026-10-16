"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertIcon, CheckIcon, ImageIcon, UploadIcon } from "@/components/ui/icons";
import { formatBytes, inspectPng, MENU_MAX_BYTES } from "@/lib/png";
import { getBrowserClient } from "@/lib/supabase/browser";
import { addDays, formatDateTime, formatMenuDate } from "@/lib/time";

type EmailResult =
  | { status: "sent"; recipient: string; providerId: string; sentAt: string }
  | { status: "failed"; recipient: string; error: string }
  | { status: "skipped"; reason: string }
  | { status: "busy"; current: string; message: string };

type Stage =
  | { name: "pick" }
  | { name: "preview" }
  | { name: "working"; step: "upload" | "publish" }
  | { name: "done"; menuId: string; menuDate: string; email: EmailResult }
  | { name: "error"; message: string };

export function MenuUploader({
  today,
  existingDates,
  recipient,
  emailEnabled,
  emailConfigured,
}: {
  today: string;
  existingDates: string[];
  recipient: string;
  emailEnabled: boolean;
  emailConfigured: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [fileError, setFileError] = useState("");
  const [menuDate, setMenuDate] = useState(today);
  const [stage, setStage] = useState<Stage>({ name: "pick" });
  const [retrying, setRetrying] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // varování při opuštění stránky během nahrávání
  useEffect(() => {
    if (stage.name !== "working") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [stage.name]);

  async function choose(f: File | undefined) {
    setFileError("");
    if (!f) return;
    if (f.size > MENU_MAX_BYTES) {
      setFileError(`Soubor je příliš velký (${formatBytes(f.size)}). Maximum je ${formatBytes(MENU_MAX_BYTES)}.`);
      return;
    }
    const check = inspectPng(new Uint8Array(await f.arrayBuffer()), f.size);
    if (!check.ok) {
      setFileError(check.error);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setDims({ width: check.width, height: check.height });
    setPreview(URL.createObjectURL(f));
    setStage({ name: "preview" });
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setDims(null);
    setMenuDate(today);
    setStage({ name: "pick" });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function publish() {
    if (!file || stage.name === "working") return;
    setStage({ name: "working", step: "upload" });
    try {
      const [y, m] = menuDate.split("-");
      const path = `${y}/${m}/${menuDate}_${crypto.randomUUID()}.png`;
      const { error: uploadError } = await getBrowserClient()
        .storage.from("menus")
        .upload(path, file, { contentType: "image/png", cacheControl: "31536000", upsert: false });
      if (uploadError) throw new Error(`Nahrání souboru selhalo: ${uploadError.message}`);

      setStage({ name: "working", step: "publish" });
      const res = await fetch("/api/admin/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: path, originalFilename: file.name, menuDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Zveřejnění selhalo (chyba ${res.status}).`);
      setStage({ name: "done", menuId: data.menu.id, menuDate, email: data.email });
    } catch (e) {
      setStage({ name: "error", message: e instanceof Error ? e.message : "Neznámá chyba." });
    }
  }

  async function retryEmail() {
    if (stage.name !== "done" || retrying) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/admin/menus/${stage.menuId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      setStage({ ...stage, email: data.email ?? { status: "failed", recipient, error: data.error ?? "Neznámá chyba." } });
    } finally {
      setRetrying(false);
    }
  }

  // ------------------------------------------------------------------ výsledek
  if (stage.name === "done") {
    const email = stage.email;
    return (
      <div className="space-y-5" aria-live="polite">
        <div className="card flex items-start gap-4 border-pond-200 bg-pond-50 p-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pond-700 text-white">
            <CheckIcon size={26} />
          </span>
          <div>
            <p className="font-display text-2xl font-semibold text-pond-950">Menu je zveřejněné</p>
            <p className="mt-1 text-pond-900 first-letter:uppercase">
              {formatMenuDate(stage.menuDate)} · na webu se zobrazuje hned. Předchozí menu zůstalo v historii.
            </p>
          </div>
        </div>

        {email.status === "sent" && (
          <div className="card flex items-start gap-4 p-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pond-100 text-pond-700">
              <CheckIcon size={26} />
            </span>
            <div>
              <p className="text-lg font-semibold text-pond-950">E-mail k tisku byl odeslán</p>
              <p className="mt-1 break-all text-ink-soft">
                Na {email.recipient} · {formatDateTime(email.sentAt)}
              </p>
            </div>
          </div>
        )}
        {email.status === "failed" && (
          <div className="card flex flex-col gap-4 border-red-200 bg-red-50 p-6 sm:flex-row sm:items-start" role="alert">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-700 text-white">
              <AlertIcon size={24} />
            </span>
            <div className="flex-1">
              <p className="text-lg font-semibold text-red-900">E-mail se nepodařilo odeslat</p>
              <p className="mt-1 text-red-900">Menu je na webu zveřejněné. Chyba: {email.error}</p>
              <button type="button" className="btn btn-danger mt-4" onClick={retryEmail} disabled={retrying}>
                {retrying ? "Odesílám…" : "Zkusit e-mail odeslat znovu"}
              </button>
            </div>
          </div>
        )}
        {email.status === "skipped" && <p className="card p-5 text-ink-soft">E-mail nebyl odeslán: {email.reason}</p>}
        {email.status === "busy" && <p className="card p-5 text-ink-soft">{email.message}</p>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/" target="_blank" className="btn btn-dark">Zobrazit na webu</Link>
          <Link href="/admin/menu/historie" className="btn btn-outline">Historie menu</Link>
          <button type="button" className="btn btn-outline" onClick={reset}>Nahrát další menu</button>
        </div>
      </div>
    );
  }

  const working = stage.name === "working";
  const dateTaken = existingDates.includes(menuDate);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* 1. výběr souboru / náhled */}
      <div>
        {!file ? (
          <label
            htmlFor="menu-file"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              choose(e.dataTransfer.files[0]);
            }}
            className={`flex min-h-[22rem] cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed p-8 text-center transition ${
              dragOver ? "border-pond-600 bg-pond-50" : "border-sand bg-white hover:border-pond-500"
            }`}
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500 text-pond-950">
              <UploadIcon size={36} />
            </span>
            <span className="font-display text-2xl font-semibold text-pond-950">Vybrat PNG s menu</span>
            <span className="max-w-xs text-sm text-ink-soft">
              Klepněte a vyberte obrázek z počítače nebo telefonu. Formát PNG, nejvýše {formatBytes(MENU_MAX_BYTES)}.
            </span>
          </label>
        ) : (
          <div className="card overflow-hidden p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- lokální náhled (blob:) */}
            <img src={preview!} alt="Náhled nahrávaného menu" className="mx-auto block h-auto max-h-[70vh] w-auto max-w-full rounded-xl" />
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-3 text-sm text-ink-soft">
              <span className="flex min-w-0 items-center gap-2">
                <ImageIcon size={16} className="shrink-0" />
                <span className="truncate">{file.name}</span>
              </span>
              <span>
                {dims?.width} × {dims?.height} px · {formatBytes(file.size)}
              </span>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          id="menu-file"
          type="file"
          accept="image/png,.png"
          className="sr-only"
          onChange={(e) => choose(e.target.files?.[0])}
          disabled={working}
        />
        {fileError && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            <AlertIcon size={18} className="mt-0.5 shrink-0" /> {fileError}
          </p>
        )}
      </div>

      {/* 2. kontrola a zveřejnění */}
      <div className="space-y-5">
        <div className="card space-y-5 p-6">
          <div>
            <label htmlFor="menu-date" className="field-label">Menu na den</label>
            <input
              id="menu-date"
              type="date"
              value={menuDate}
              min={addDays(today, -60)}
              max={addDays(today, 30)}
              onChange={(e) => setMenuDate(e.target.value || today)}
              className="field"
              disabled={working}
            />
            <p className="mt-2 text-sm text-ink-soft first-letter:uppercase">{formatMenuDate(menuDate)}{menuDate === today && " (dnes)"}</p>
            {dateTaken && (
              <p className="mt-2 text-sm text-amber-700">Pro tento den už menu existuje. Nové ho na webu nahradí, původní zůstane v historii.</p>
            )}
          </div>

          <div className="rounded-xl bg-cream/70 px-4 py-3 text-sm text-ink-soft">
            {emailEnabled && emailConfigured ? (
              <>Po zveřejnění se PNG automaticky odešle k tisku na <strong className="break-all text-ink">{recipient}</strong>.</>
            ) : !emailEnabled ? (
              <>Automatické odesílání e-mailem je v nastavení vypnuté.</>
            ) : (
              <>E-mailová služba není nastavená – menu se zveřejní, ale e-mail se neodešle.</>
            )}
          </div>

          <button type="button" className="btn btn-primary !min-h-14 w-full !text-lg" onClick={publish} disabled={!file || working}>
            {working ? (stage.step === "upload" ? "Nahrávám soubor…" : "Zveřejňuji a odesílám…") : "Zveřejnit menu"}
          </button>
          {file && !working && (
            <button type="button" className="btn btn-outline w-full" onClick={reset}>
              Vybrat jiný soubor
            </button>
          )}
        </div>

        {stage.name === "error" && (
          <div role="alert" className="card border-red-200 bg-red-50 p-5 text-red-900">
            <p className="font-semibold">Menu se nepodařilo zveřejnit</p>
            <p className="mt-1 text-sm">{stage.message}</p>
            <button type="button" className="btn btn-danger mt-4" onClick={publish} disabled={!file}>
              Zkusit znovu
            </button>
          </div>
        )}

        <ol className="space-y-2 px-1 text-sm text-ink-soft">
          <li><strong className="text-ink">1.</strong> Vyberte PNG s menu.</li>
          <li><strong className="text-ink">2.</strong> Zkontrolujte náhled a datum.</li>
          <li><strong className="text-ink">3.</strong> Klikněte na „Zveřejnit menu“ – o zbytek se postará systém.</li>
        </ol>
      </div>
    </div>
  );
}
