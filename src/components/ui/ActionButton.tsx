"use client";
import { useTransition, type ReactNode } from "react";
import type { ActionResult } from "@/lib/actions/result";
import { Button } from "./Button";
import { useToast } from "./Toast";

/** Tlačítko volající serverovou akci, volitelně s potvrzením. */
export function ActionButton({
  action, confirm, children, variant = "ghost", size = "sm", icon, className, onDone,
}: {
  action: () => Promise<ActionResult>;
  confirm?: string;
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "icon";
  icon?: ReactNode;
  className?: string;
  onDone?: () => void;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      icon={icon}
      className={className}
      loading={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const r = await action();
          if (r.ok) {
            if (r.message) toast(r.message);
            onDone?.();
          } else toast(r.error ?? "Akce se nepovedla", "error");
        });
      }}
    >
      {children}
    </Button>
  );
}
