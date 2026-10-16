"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { AlertIcon, CheckIcon } from "@/components/ui/icons";

export type ActionState = { ok: boolean; message: string } | null;
export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({ children, className = "btn btn-dark", pendingText = "Ukládám…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

export function StatusMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium ${state.ok ? "bg-pond-50 text-pond-900" : "bg-red-50 text-red-800"}`}
    >
      {state.ok ? <CheckIcon size={18} className="mt-0.5 shrink-0" /> : <AlertIcon size={18} className="mt-0.5 shrink-0" />}
      {state.message}
    </p>
  );
}

/** Formulář napojený na server action s hlášením výsledku. */
export function ActionForm({
  action,
  children,
  className = "space-y-5",
  resetOnSuccess = false,
  confirmText,
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirmText?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
      <StatusMessage state={state} />
    </form>
  );
}

export function PageTitle({ title, intro, children }: { title: string; intro?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-semibold text-pond-950 sm:text-4xl">{title}</h1>
        {intro && <p className="mt-2 max-w-2xl text-ink-soft">{intro}</p>}
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, children, description }: { title?: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-7">
      {title && <h2 className="font-display text-xl font-semibold text-pond-950">{title}</h2>}
      {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      <div className={title || description ? "mt-5" : ""}>{children}</div>
    </section>
  );
}
