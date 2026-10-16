import { formatDateTime } from "@/lib/time";
import type { DailyMenu, EmailStatus } from "@/lib/types";

const EMAIL: Record<EmailStatus, { label: string; cls: string }> = {
  pending: { label: "E-mail čeká", cls: "bg-cream text-ink-soft" },
  sending: { label: "E-mail se odesílá", cls: "bg-amber-300/40 text-amber-700" },
  sent: { label: "E-mail odeslán", cls: "bg-pond-100 text-pond-800" },
  failed: { label: "E-mail selhal", cls: "bg-red-100 text-red-800" },
  skipped: { label: "E-mail vypnut", cls: "bg-cream text-ink-soft" },
};

export function EmailBadge({ status }: { status: EmailStatus }) {
  const s = EMAIL[status];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

export function PublishBadge({ menu }: { menu: Pick<DailyMenu, "is_current" | "published_at"> }) {
  if (menu.is_current) return <span className="inline-flex rounded-full bg-pond-900 px-2.5 py-1 text-xs font-semibold text-paper">Zveřejněno na webu</span>;
  if (menu.published_at) return <span className="inline-flex rounded-full bg-cream px-2.5 py-1 text-xs font-semibold text-ink-soft">V archivu</span>;
  return <span className="inline-flex rounded-full bg-amber-300/40 px-2.5 py-1 text-xs font-semibold text-amber-700">Nezveřejněno</span>;
}

export function EmailDetail({ menu }: { menu: Pick<DailyMenu, "email_status" | "email_sent_at" | "email_recipient" | "email_last_error"> }) {
  if (menu.email_status === "sent") {
    return (
      <span>
        Odesláno {formatDateTime(menu.email_sent_at)} na {menu.email_recipient}
      </span>
    );
  }
  if (menu.email_status === "failed") return <span className="text-red-800">Chyba: {menu.email_last_error ?? "neznámá"}</span>;
  return null;
}
