"use client";

import { useEffect } from "react";
import { PrintIcon } from "@/components/ui/icons";

/** Po načtení obrázku automaticky otevře dialog tisku. */
export function PrintTrigger() {
  useEffect(() => {
    const img = document.querySelector("main img") as HTMLImageElement | null;
    const print = () => window.setTimeout(() => window.print(), 150);
    if (!img) return;
    if (img.complete) print();
    else img.addEventListener("load", print, { once: true });
    return () => img.removeEventListener("load", print);
  }, []);
  return (
    <button type="button" className="btn btn-dark !min-h-10" onClick={() => window.print()}>
      <PrintIcon size={18} /> Vytisknout
    </button>
  );
}
