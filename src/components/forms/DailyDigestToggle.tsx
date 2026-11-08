"use client";
import { useState, useTransition } from "react";
import { setDailyDigest } from "@/lib/actions/prefs";
import { Toggle } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export function DailyDigestToggle({ initial, premium }: { initial: boolean; premium: boolean }) {
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  const toast = useToast();
  return (
    <Toggle label="Večerní souhrn dne" description={premium ? "Kolik jste dnes utratili a kolik můžete bezpečně utratit zítra (potřebuje zapnutá oznámení výše)." : "Součást Premium."}
      checked={on} disabled={!premium} onChange={(e) => { const v = e.target.checked; setOn(v); start(async () => { await setDailyDigest(v); toast(v ? "Souhrn zapnut" : "Souhrn vypnut"); }); }} />
  );
}
