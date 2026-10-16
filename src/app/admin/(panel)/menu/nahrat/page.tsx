import { PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email/menu-email";
import { addDays, pragueToday } from "@/lib/time";
import type { PrivateSettings } from "@/lib/types";
import { MenuUploader } from "./MenuUploader";

export const metadata = { title: "Nahrát menu" };

export default async function UploadMenuPage() {
  const { supabase } = await requireAdmin();
  const today = pragueToday();
  const [{ data: priv }, { data: existing }] = await Promise.all([
    supabase.from("private_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("daily_menus").select("menu_date").gte("menu_date", addDays(today, -7)).lte("menu_date", addDays(today, 30)),
  ]);
  const settings = priv as PrivateSettings | null;
  return (
    <>
      <PageTitle title="Nahrát dnešní menu" intro="Vyberte obrázek menu ve formátu PNG, zkontrolujte náhled a klikněte na „Zveřejnit menu“." />
      <MenuUploader
        today={today}
        existingDates={[...new Set((existing ?? []).map((e) => e.menu_date as string))]}
        recipient={settings?.menu_email_recipient ?? "info@rybnickarestaurace.cz"}
        emailEnabled={settings?.menu_email_enabled ?? true}
        emailConfigured={isEmailConfigured()}
      />
    </>
  );
}
