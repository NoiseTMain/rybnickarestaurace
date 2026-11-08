"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white"><Printer className="h-4 w-4" />Tisk / uložit jako PDF</button>;
}
