import { redirect } from "next/navigation";
import { Logo, logoUrl } from "@/components/site/Logo";
import { getAdmin } from "@/lib/auth";
import { getSiteSettings } from "@/lib/data/public";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Přihlášení" };

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  const settings = await getSiteSettings();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center text-pond-900">
          <Logo url={logoUrl(settings)} name={settings.restaurant_name} className="h-16" textClassName="text-3xl" />
          <p className="text-sm font-semibold tracking-[0.16em] text-ink-soft uppercase">Administrace</p>
        </div>
        {isSupabaseConfigured() ? (
          <LoginForm />
        ) : (
          <p className="card p-5 text-sm text-red-800">
            Aplikace není připojena k databázi. Doplňte proměnné NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY (viz README).
          </p>
        )}
      </div>
    </main>
  );
}
