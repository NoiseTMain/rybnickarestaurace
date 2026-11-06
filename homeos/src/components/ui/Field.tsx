"use client";
import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-ink-2">
      <span>{children}</span>
      {hint && <span className="font-normal text-ink-3">{hint}</span>}
    </label>
  );
}

export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1 text-xs text-neg">{error}</p>;
}

type Common = { label?: ReactNode; hint?: ReactNode; error?: string; className?: string };

export function Input({ label, hint, error, className, id, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? (rest.name ? `f-${rest.name}${auto}` : auto);
  return (
    <div className={className}>
      {label && <Label htmlFor={fid} hint={hint}>{label}</Label>}
      <input id={fid} aria-invalid={error ? true : undefined} className="field" {...rest} />
      <FieldError error={error} />
    </div>
  );
}

export function MoneyInput({ label, hint, error, className, id, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? (rest.name ? `f-${rest.name}${auto}` : auto);
  return (
    <div className={className}>
      {label && <Label htmlFor={fid} hint={hint}>{label}</Label>}
      <div className="relative">
        <input id={fid} inputMode="decimal" autoComplete="off" placeholder="0" aria-invalid={error ? true : undefined} className="field num pr-12" {...rest} />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">Kč</span>
      </div>
      <FieldError error={error} />
    </div>
  );
}

export function Select({ label, hint, error, className, id, children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fid = id ?? (rest.name ? `f-${rest.name}${auto}` : auto);
  return (
    <div className={className}>
      {label && <Label htmlFor={fid} hint={hint}>{label}</Label>}
      <select id={fid} aria-invalid={error ? true : undefined} className="field" {...rest}>
        {children}
      </select>
      <FieldError error={error} />
    </div>
  );
}

export function Textarea({ label, hint, error, className, id, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? (rest.name ? `f-${rest.name}${auto}` : auto);
  return (
    <div className={className}>
      {label && <Label htmlFor={fid} hint={hint}>{label}</Label>}
      <textarea id={fid} rows={2} aria-invalid={error ? true : undefined} className="field resize-y" {...rest} />
      <FieldError error={error} />
    </div>
  );
}

export function Toggle({ label, description, className, error, ...rest }: { label: ReactNode; description?: ReactNode; error?: string; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl py-1">
        <input type="checkbox" className="peer sr-only" {...rest} />
        <span className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-white/15 transition peer-checked:bg-gold after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-gold" />
        <span className="min-w-0">
          <span className="block text-sm text-ink">{label}</span>
          {description && <span className="block text-xs text-ink-3">{description}</span>}
        </span>
      </label>
      <FieldError error={error} />
    </div>
  );
}

export function Segmented<T extends string>({ name, value, onChange, options, className }: { name: string; value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn("flex rounded-full bg-white/[0.05] p-1 border border-white/[0.08]", className)} role="radiogroup">
      <input type="hidden" name={name} value={value} />
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("flex-1 rounded-full px-3 py-1.5 text-sm transition", value === o.value ? "bg-ink text-base font-medium" : "text-ink-2 hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="rounded-xl border border-neg/30 bg-neg/10 px-3 py-2 text-sm text-neg" role="alert">{error}</div>;
}
