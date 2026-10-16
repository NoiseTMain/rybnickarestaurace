import { AdminShell } from "@/components/admin/AdminShell";
import { logoUrl } from "@/components/site/Logo";
import { requireAdmin } from "@/lib/auth";
import type { SiteSettings } from "@/lib/types";
import { signOut } from "../actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireAdmin();
  const [{ data: settings }, { count }] = await Promise.all([
    supabase.from("site_settings").select("restaurant_name,logo_path").eq("id", 1).maybeSingle(),
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  const s = (settings ?? { restaurant_name: "Restaurace Rybníky", logo_path: null }) as Pick<SiteSettings, "restaurant_name" | "logo_path">;
  return (
    <AdminShell logo={logoUrl(s)} name={s.restaurant_name} userEmail={user.email ?? ""} signOut={signOut} newInquiries={count ?? 0}>
      {children}
    </AdminShell>
  );
}
