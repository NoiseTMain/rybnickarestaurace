"use client";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

const variants = {
  primary: "bg-gradient-to-b from-gold-bright to-gold text-[#1b1407] shadow-[0_8px_24px_-8px_rgb(var(--accent-rgb)/0.6)] hover:brightness-105",
  secondary: "bg-white/[0.07] text-ink border border-white/10 hover:bg-white/[0.11]",
  ghost: "text-ink-2 hover:text-ink hover:bg-white/[0.06]",
  danger: "bg-neg/15 text-neg border border-neg/25 hover:bg-neg/25",
  dark: "bg-black/70 text-ink border border-white/10 hover:bg-black/90",
} as const;

const sizes = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-5 text-[15px] gap-2", icon: "h-9 w-9 justify-center" } as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; size?: keyof typeof sizes; loading?: boolean; icon?: ReactNode };

export function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        variants[variant], sizes[size], className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "secondary", size = "md", className, children, icon }: { href: string; variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string; children?: ReactNode; icon?: ReactNode }) {
  const cls = cn("inline-flex items-center rounded-full font-medium transition-all active:scale-[0.98]", variants[variant], sizes[size], className);
  // API (exporty, zálohy) = stažení souboru: obyčejný odkaz, aby ho router nepřednačítal
  if (href.startsWith("/api/")) return <a href={href} download className={cls}>{icon}{children}</a>;
  return (
    <Link href={href} className={cls}>
      {icon}
      {children}
    </Link>
  );
}
