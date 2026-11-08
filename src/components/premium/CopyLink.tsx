"use client";
import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function CopyLink({ link }: { link: string }) {
  const toast = useToast();
  const share = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2">
      <code className="min-w-0 flex-1 break-all text-xs text-gold-bright" data-testid="referral-link">{link}</code>
      <Button size="sm" variant="ghost" icon={<Copy className="h-4 w-4" />} onClick={() => { void navigator.clipboard?.writeText(link); toast("Odkaz zkopírován"); }}>Kopírovat</Button>
      {share && <Button size="sm" variant="ghost" icon={<Share2 className="h-4 w-4" />} onClick={() => void navigator.share({ title: "HomeOS", text: "Zkus HomeOS – rodinné finance pod kontrolou. Přes můj odkaz máme oba měsíc Premium zdarma.", url: link }).catch(() => undefined)}>Sdílet</Button>}
    </div>
  );
}
