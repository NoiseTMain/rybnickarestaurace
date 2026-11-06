"use client";
import { useCallback, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

/** Tlačítko, které otevře dialog s formulářem. Formulář dostane funkci close(). */
export function ModalButton({
  label, title, icon, variant = "secondary", size = "md", wide, className, render,
}: {
  label?: ReactNode;
  title: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg" | "icon";
  wide?: boolean;
  className?: string;
  render: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button type="button" variant={variant} size={size} icon={icon} className={className} onClick={() => setOpen(true)} aria-label={typeof label === "string" ? undefined : typeof title === "string" ? title : undefined}>
        {label}
      </Button>
      <Modal open={open} onClose={close} title={title} wide={wide}>
        {open && render(close)}
      </Modal>
    </>
  );
}
