import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { appMode } from "@/lib/env";
import { AuthCard } from "../AuthCard";
import { LoginForm } from "../AuthForms";

export const metadata = { title: "Přihlášení" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return (
    <AuthCard
      title="Vítejte zpět"
      subtitle="Přihlaste se do své finanční centrály."
      footer={<>Nemáte účet? <Link href="/registrace" className="text-gold hover:underline">Zaregistrujte se</Link> · <Link href="/obnova-hesla" className="text-ink-2 hover:underline">Zapomenuté heslo</Link></>}
    >
      {appMode() === "local" && <p className="mb-4 rounded-xl bg-info/10 px-3 py-2 text-xs text-info">Běží lokální vývojový režim (bez Supabase). Účty a data se ukládají do souboru <code>.data/homeos.json</code>.</p>}
      <LoginForm />
    </AuthCard>
  );
}
