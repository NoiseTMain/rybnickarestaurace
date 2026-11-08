"use client";
import { ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addWeekPlan } from "@/lib/actions/recipes";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function WeekPlanButton({ ids }: { ids: string[] }) {
  const [n, setN] = useState(2);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm">Porcí
        <select className="field !h-10 !w-20" value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Počet porcí">{[1, 2, 3, 4, 5, 6].map((x) => <option key={x} value={x}>{x}</option>)}</select>
      </label>
      <Button variant="primary" loading={pending} icon={<ShoppingCart className="h-4 w-4" />} onClick={() => start(async () => {
        const r = await addWeekPlan(ids, n);
        if (r.ok) { toast(r.message ?? "Hotovo"); router.push("/planovani"); } else toast(r.error ?? "Chyba", "error");
      })}>Vše do nákupního seznamu</Button>
    </div>
  );
}
