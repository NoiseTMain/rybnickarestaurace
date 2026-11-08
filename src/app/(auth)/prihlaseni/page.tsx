import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { appMode } from "@/lib/env";
import { AuthCard } from "../AuthCard";
import { oauthProviders } from "@/lib/oauth";
import { LoginForm, OAuthButtons } from "../AuthForms";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Přihlášení" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  const { t } = await getT();
  return (
    <AuthCard
      title={t("auth.welcomeBack")}
      subtitle={t("auth.loginSub")}
      footer={<>{t("auth.noAccount")} <Link href="/registrace" className="text-gold hover:underline">{t("auth.register")}</Link> · <Link href="/obnova-hesla" className="text-ink-2 hover:underline">{t("auth.forgot")}</Link></>}
    >
      {appMode() === "local" && <p className="mb-4 rounded-xl bg-info/10 px-3 py-2 text-xs text-info">Běží lokální vývojový režim (bez Supabase). Účty a data se ukládají do souboru <code>.data/homeos.json</code>.</p>}
      <LoginForm />
      <OAuthButtons providers={oauthProviders()} />
    </AuthCard>
  );
}
