"use client";
import { ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { setMemberPermissions } from "@/lib/actions/household";
import { PERMISSION_SECTIONS, type PermissionSection, type Permissions } from "@/lib/db/types";
import { ModalButton } from "@/components/ui/ModalButton";
import { Segmented } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function PermissionsForm({ userId, initial, onDone }: { userId: string; initial: Permissions; onDone: () => void }) {
  const [perms, setPerms] = useState<Record<PermissionSection, "edit" | "view">>(
    Object.fromEntries((Object.keys(PERMISSION_SECTIONS) as PermissionSection[]).map((k) => [k, initial[k] ?? "edit"])) as Record<PermissionSection, "edit" | "view">,
  );
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">Člen vidí vždy všechna data domácnosti. Tady určíte, co smí <b>upravovat</b>. Nově připojený člen má plná práva.</p>
      <ul className="space-y-3">
        {(Object.keys(PERMISSION_SECTIONS) as PermissionSection[]).map((k) => (
          <li key={k} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm">{PERMISSION_SECTIONS[k]}</span>
            <Segmented name={`perm-${k}`} value={perms[k]} onChange={(v) => setPerms({ ...perms, [k]: v })} className="sm:w-64" options={[{ value: "edit", label: "Upravovat" }, { value: "view", label: "Jen číst" }]} />
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-3">
        <Button variant="ghost" onClick={onDone}>Zrušit</Button>
        <Button variant="primary" loading={pending} onClick={() => start(async () => {
          const r = await setMemberPermissions(userId, perms);
          if (r.ok) { toast(r.message ?? "Uloženo"); onDone(); } else toast(r.error ?? "Chyba", "error");
        })}>Uložit oprávnění</Button>
      </div>
    </div>
  );
}

export function PermissionsButton({ userId, name, initial }: { userId: string; name: string; initial: Permissions }) {
  const limited = Object.values(initial).filter((v) => v === "view").length;
  return (
    <ModalButton size="sm" variant="secondary" icon={<ShieldCheck className="h-4 w-4" />} label={limited ? `Práva (${limited} omezeno)` : "Práva"} title={`Oprávnění – ${name}`}
      render={(close) => <PermissionsForm userId={userId} initial={initial} onDone={close} />} />
  );
}
