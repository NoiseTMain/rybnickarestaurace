"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckIcon } from "@/components/ui/icons";
import { pragueToday } from "@/lib/time";

type Kind = "reservation" | "event";

export function InquiryForm({ defaultKind = "reservation", spaces, phone, tel }: { defaultKind?: Kind; spaces: string[]; phone: string; tel: string }) {
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;
    const form = new FormData(e.currentTarget);
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: form.get("name"),
          phone: form.get("phone"),
          email: form.get("email") || undefined,
          eventDate: form.get("eventDate") || undefined,
          eventTime: form.get("eventTime") || undefined,
          guests: form.get("guests") || undefined,
          space: form.get("space") || undefined,
          message: form.get("message") || undefined,
          website: form.get("website") || undefined,
          consent: form.get("consent") === "on",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Odeslání se nezdařilo.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Odeslání se nezdařilo.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="card px-6 py-12 text-center" role="status">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pond-100 text-pond-700">
          <CheckIcon size={28} />
        </span>
        <p className="mt-4 font-display text-2xl text-pond-950">Děkujeme, poptávku jsme přijali</p>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">
          Ozveme se vám co nejdříve. {kind === "reservation" ? "Rezervace je platná až po našem potvrzení." : ""} Spěcháte?
          Zavolejte na <a href={tel} className="font-semibold text-pond-700 underline">{phone}</a>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-5 sm:p-8" noValidate={false}>
      <fieldset>
        <legend className="field-label">Co potřebujete?</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(
            [
              ["reservation", "Rezervace stolu"],
              ["event", "Oslava / pronájem prostor"],
            ] as const
          ).map(([k, label]) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center justify-center rounded-xl border-2 px-3 py-3 text-center text-sm font-semibold transition ${
                kind === k ? "border-pond-700 bg-pond-50 text-pond-900" : "border-line text-ink-soft"
              }`}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="inq-name">Jméno a příjmení *</label>
          <input id="inq-name" name="name" required minLength={2} maxLength={120} autoComplete="name" className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="inq-phone">Telefon *</label>
          <input id="inq-phone" name="phone" type="tel" required minLength={5} maxLength={40} autoComplete="tel" inputMode="tel" className="field" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="inq-email">E-mail</label>
          <input id="inq-email" name="email" type="email" maxLength={200} autoComplete="email" className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="inq-date">Datum</label>
          <input id="inq-date" name="eventDate" type="date" min={pragueToday()} className="field" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="inq-time">Čas</label>
            <input id="inq-time" name="eventTime" type="time" className="field" />
          </div>
          <div>
            <label className="field-label" htmlFor="inq-guests">Počet osob</label>
            <input id="inq-guests" name="guests" type="number" min={1} max={1000} inputMode="numeric" className="field" />
          </div>
        </div>
        {kind === "event" && spaces.length > 0 && (
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="inq-space">Prostor</label>
            <select id="inq-space" name="space" className="field" defaultValue="">
              <option value="">Nevím / poradíte mi</option>
              {spaces.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="inq-message">{kind === "event" ? "Popis akce" : "Poznámka"}</label>
          <textarea
            id="inq-message"
            name="message"
            maxLength={4000}
            className="field"
            placeholder={kind === "event" ? "Typ akce, představa o občerstvení, časový rozsah…" : "Např. dětská židlička, místo na zahrádce…"}
          />
        </div>
      </div>

      {/* honeypot proti robotům */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Web <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input type="checkbox" name="consent" required className="mt-1 h-5 w-5 shrink-0 accent-pond-700" />
        <span>
          Souhlasím se zpracováním uvedených údajů za účelem vyřízení poptávky.{" "}
          <Link href="/ochrana-udaju" className="underline underline-offset-2">Více informací</Link>
        </span>
      </label>

      {state === "error" && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="submit" className="btn btn-dark w-full sm:w-auto" disabled={state === "sending"}>
          {state === "sending" ? "Odesílám…" : kind === "event" ? "Odeslat poptávku" : "Odeslat rezervaci"}
        </button>
        <p className="text-sm text-ink-soft">
          nebo zavolejte <a href={tel} className="font-semibold whitespace-nowrap text-pond-700">{phone}</a>
        </p>
      </div>
    </form>
  );
}
