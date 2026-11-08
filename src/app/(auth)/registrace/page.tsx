import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AuthCard } from "../AuthCard";
import { oauthProviders } from "@/lib/oauth";
import { OAuthButtons, RegisterForm } from "../AuthForms";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Registrace" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await getUser()) redirect("/");
  const ref = (await searchParams).ref;
  const referral = ref && /^[A-Za-z0-9]{6,12}$/.test(ref) ? ref.toUpperCase() : undefined;
  const { t } = await getT();
  return (
    <AuthCard title={t("auth.newAccount")} subtitle={t("auth.registerSub")} footer={<>{t("auth.haveAccount")} <Link href="/prihlaseni" className="text-gold hover:underline">{t("auth.login")}</Link></>}>
      <RegisterForm referral={referral} />
      <OAuthButtons providers={oauthProviders()} />
    </AuthCard>
  );
}
