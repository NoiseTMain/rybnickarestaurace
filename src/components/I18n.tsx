"use client";
import { createContext, useContext, useTransition, type ReactNode } from "react";
import { LOCALES, translate, type Key, type Locale } from "@/lib/i18n/dict";
import { setLocale } from "@/lib/actions/locale";

const Ctx = createContext<Locale>("cs");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useT() {
  const locale = useContext(Ctx);
  return { locale, t: (key: Key, vars?: Record<string, string | number>) => translate(locale, key, vars) };
}

/** Přepínač jazyka (vlajky). */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale } = useT();
  const [pending, start] = useTransition();
  return (
    <div className={`flex gap-1 ${pending ? "opacity-60" : ""} ${className}`} role="radiogroup" aria-label="Jazyk / Language">
      {LOCALES.map((l) => (
        <button key={l.key} type="button" role="radio" aria-checked={locale === l.key} title={l.label} aria-label={l.label}
          onClick={() => start(async () => { await setLocale(l.key); window.location.reload(); })}
          className={`rounded-full px-2 py-1 text-sm ${locale === l.key ? "bg-white/15" : "opacity-60 hover:opacity-100"}`}>
          {l.flag}
        </button>
      ))}
    </div>
  );
}
