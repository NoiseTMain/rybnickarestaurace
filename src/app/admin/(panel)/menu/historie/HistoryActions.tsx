"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EmailStatus } from "@/lib/types";

export function HistoryActions({
  id,
  url,
  downloadUrl,
  isCurrent,
  emailStatus,
  emailSentAt,
  label,
}: {
  id: string;
  url: string;
  downloadUrl: string;
  isCurrent: boolean;
  emailStatus: EmailStatus;
  emailSentAt: string | null;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "email" | "publish" | "delete">(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(kind: "email" | "publish" | "delete", init: RequestInit, path: string) {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (kind === "email") {
        const e = data.email;
        if (e?.status === "sent") setMessage({ ok: true, text: `E-mail odeslán na ${e.recipient}.` });
        else setMessage({ ok: false, text: e?.error ?? e?.message ?? e?.reason ?? data.error ?? "Odeslání selhalo." });
      } else if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Akce selhala." });
      } else {
        setMessage({ ok: true, text: kind === "publish" ? "Menu je znovu zveřejněné na webu." : "Menu bylo smazáno." });
      }
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Spojení selhalo. Zkuste to znovu." });
    } finally {
      setBusy(null);
    }
  }

  function sendEmail() {
    let force = false;
    if (emailStatus === "sent") {
      if (!window.confirm(`E-mail s tímto menu už byl odeslán${emailSentAt ? ` (${emailSentAt})` : ""}. Opravdu ho odeslat znovu?`)) return;
      force = true;
    }
    call("email", { method: "POST", body: JSON.stringify({ force }) }, `/api/admin/menus/${id}/email`);
  }

  function publish() {
    if (!window.confirm(`Zveřejnit menu ${label} na webu místo aktuálního?`)) return;
    call("publish", { method: "POST" }, `/api/admin/menus/${id}/publish`);
  }

  function remove() {
    const warning = isCurrent ? "\n\nToto menu je právě zveřejněné – web pak bude ukazovat „Dnešní menu připravujeme“." : "";
    if (!window.confirm(`Opravdu trvale smazat menu ${label}?${warning}`)) return;
    call("delete", { method: "DELETE" }, `/api/admin/menus/${id}`);
  }

  const small = "btn !min-h-10 !px-4 !text-sm";
  return (
    <div className="pt-2">
      <div className="flex flex-wrap gap-2">
        <a href={url} target="_blank" rel="noopener" className={`${small} btn-outline`}>Zobrazit</a>
        <a href={downloadUrl} className={`${small} btn-outline`}>Stáhnout PNG</a>
        <button type="button" className={`${small} btn-outline`} onClick={sendEmail} disabled={busy !== null || emailStatus === "sending"}>
          {busy === "email" ? "Odesílám…" : emailStatus === "sent" ? "Znovu odeslat e-mail" : "Odeslat e-mail"}
        </button>
        {!isCurrent && (
          <button type="button" className={`${small} btn-dark`} onClick={publish} disabled={busy !== null}>
            {busy === "publish" ? "Zveřejňuji…" : "Znovu zveřejnit"}
          </button>
        )}
        <button type="button" className={`${small} border border-red-200 bg-white text-red-800 hover:bg-red-50`} onClick={remove} disabled={busy !== null}>
          {busy === "delete" ? "Mažu…" : "Smazat"}
        </button>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-pond-50 text-pond-900" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
