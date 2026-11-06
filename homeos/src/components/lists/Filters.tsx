"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** Filtry ukládané do URL (sdílitelné, funguje tlačítko zpět). */
export function useFilter() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (key: string, value: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    start(() => router.replace(`${path}${p.size ? `?${p}` : ""}`, { scroll: false }));
  };
  return { params, set, pending };
}

export function FilterSelect({ name, label, children }: { name: string; label: string; children: ReactNode }) {
  const { params, set } = useFilter();
  return (
    <select aria-label={label} className="field !w-auto !py-2 !text-sm" value={params.get(name) ?? ""} onChange={(e) => set(name, e.target.value || null)}>
      {children}
    </select>
  );
}

export function FilterSearch({ name = "q", placeholder = "Hledat…" }: { name?: string; placeholder?: string }) {
  const { params, set } = useFilter();
  return (
    <input type="search" aria-label={placeholder} placeholder={placeholder} className="field !w-full !py-2 !text-sm sm:!w-56" defaultValue={params.get(name) ?? ""}
      onKeyDown={(e) => { if (e.key === "Enter") set(name, (e.target as HTMLInputElement).value || null); }}
      onBlur={(e) => { if ((params.get(name) ?? "") !== e.target.value) set(name, e.target.value || null); }} />
  );
}

export function FilterTabs({ name, options }: { name: string; options: { value: string; label: string; count?: number }[] }) {
  const { params, set } = useFilter();
  const current = params.get(name) ?? "";
  return (
    <div className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => set(name, o.value || null)}
          className={cn("whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition", current === o.value ? "bg-ink text-base font-medium" : "bg-white/[0.05] text-ink-2 hover:bg-white/10")}>
          {o.label}{o.count != null && <span className="ml-1 text-xs opacity-60">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function MonthPicker({ name = "mesic", value }: { name?: string; value: string }) {
  const { set } = useFilter();
  return <input type="month" aria-label="Měsíc" className="field !w-auto !py-2 !text-sm" value={value} onChange={(e) => set(name, e.target.value || null)} />;
}
