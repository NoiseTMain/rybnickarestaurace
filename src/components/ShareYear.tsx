"use client";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/** Sdílení roku bez konkrétních částek (soukromí). */
export function ShareYear({ year, savingsRate, plusMonths, noSpend, streak, topCategory }: { year: string; savingsRate: number; plusMonths: number; noSpend: number; streak: number; topCategory: string | null }) {
  const toast = useToast();
  const text = [`Můj rok ${year} s HomeOS 📊`, `🐷 odložil(a) jsem ${Math.max(0, Math.round(savingsRate * 100))} % příjmů`, `📅 ${plusMonths} měsíců v plusu`, `🧘 ${noSpend} dní bez utrácení`, `🔥 série ${streak} dní zápisů`, topCategory ? `🥇 nejvíc padlo na: ${topCategory}` : null].filter(Boolean).join("\n");
  return (
    <Button variant="secondary" size="md" icon={<Share2 className="h-4 w-4" />} onClick={async () => {
      const url = `${location.origin}/vitejte`;
      if (navigator.share) await navigator.share({ title: `Můj rok ${year}`, text, url }).catch(() => undefined);
      else { await navigator.clipboard?.writeText(`${text}\n${url}`); toast("Zkopírováno – vložte kamkoli"); }
    }}>Sdílet (bez částek)</Button>
  );
}
