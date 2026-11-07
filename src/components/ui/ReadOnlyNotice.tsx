import { Eye } from "lucide-react";
import { canEdit, type AppContext } from "@/lib/context";
import { PERMISSION_SECTIONS, type PermissionSection } from "@/lib/db/types";

/** Upozornění pro člena, který smí sekci jen číst. */
export function ReadOnlyNotice({ ctx, section, className = "" }: { ctx: AppContext; section: PermissionSection; className?: string }) {
  if (canEdit(ctx, section)) return null;
  return (
    <div className={`flex items-center gap-2 rounded-2xl border border-info/30 bg-info/10 px-4 py-2.5 text-sm text-info ${className}`}>
      <Eye className="h-4 w-4 shrink-0" />
      <span>Sekci „{PERMISSION_SECTIONS[section]}“ můžete jen prohlížet. Úpravy povoluje vlastník domácnosti.</span>
    </div>
  );
}
