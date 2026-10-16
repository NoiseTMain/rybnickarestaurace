"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRightIcon } from "@/components/ui/icons";

/** Přepínač Jídla / Nápoje na úvodní stránce */
export function CatalogTabs({ food, drinks }: { food: ReactNode; drinks: ReactNode }) {
  const [tab, setTab] = useState<"food" | "drink">("food");
  const tabs = [
    { key: "food" as const, label: "Jídelní lístek", href: "/jidelni-listek" },
    { key: "drink" as const, label: "Nápojový lístek", href: "/napojovy-listek" },
  ];
  const active = tabs.find((t) => t.key === tab)!;
  return (
    <div>
      <div role="tablist" aria-label="Lístek" className="inline-flex rounded-full border border-line bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-2.5 text-sm font-semibold transition sm:px-6 ${
              tab === t.key ? "bg-pond-900 text-paper" : "text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-10">
        {tab === "food" ? food : drinks}
      </div>
      <Link href={active.href} className="mt-10 inline-flex items-center gap-2 font-semibold text-pond-700 hover:text-pond-900">
        Celý {active.label.toLowerCase()} <ArrowRightIcon size={18} />
      </Link>
    </div>
  );
}
