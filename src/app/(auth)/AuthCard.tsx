import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/I18n";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        <div className="mb-3 flex justify-end"><LanguageSwitcher /></div>
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-bright to-gold-deep text-lg font-bold text-[#1b1407] shadow-[0_8px_30px_-8px_rgb(var(--accent-rgb)/0.8)]">H</span>
          <span className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">Home<span className="gold-text">OS</span></span>
        </div>
        <div className="glass rounded-[28px] p-6 sm:p-8">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-ink-2">{footer}</div>}
      </div>
    </main>
  );
}
